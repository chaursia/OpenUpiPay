import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/auth/middleware";
import { fetchUnseenUpiEmails, getImapConfigFromEnv } from "@/lib/email/imapPoller";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { hashUtr } from "@/lib/utils/utr";
import { fireHmacCallback } from "@/lib/payment/webhook";
import type { OrderRow, ApiKeyRow } from "@/types/database";

type OrderWithRelations = OrderRow & {
  vpas?: { vpa_address: string; payee_name: string } | null;
  api_keys?: ApiKeyRow | null;
};

type LedgerRow = { id: string; order_id: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // Vercel: fail fast instead of hanging 300s

/**
 * POST /api/v1/cron/email-poll
 * Header: x-cron-secret (or session auth for admin manual trigger)
 *
 * Connects to IMAP inbox, scans unseen emails for UPI confirmations,
 * extracts amount and UTR, and reconciles matching PENDING orders.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret === process.env.CRON_SECRET;

  // If not cron secret, check if admin call (has cookie or Authorization)
  if (!isCron && process.env.CRON_SECRET) {
    try {
      validateCronSecret(req);
    } catch (err) {
      if (err instanceof NextResponse) return err;
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let imapConfig;
  try {
    imapConfig = getImapConfigFromEnv();
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }

  try {
    // Hard cap the entire IMAP round-trip at 25s so we never hit Vercel's
    // 300s FUNCTION_INVOCATION_TIMEOUT — returns a clean JSON error instead.
    const emails = await Promise.race([
      fetchUnseenUpiEmails(imapConfig, 20),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("IMAP poll timed out after 25s — check IMAP_HOST/PORT/credentials and that IMAP is enabled on the mailbox")), 25_000)
      ),
    ]);
    const supabase = createSupabaseAdminClient();
    const processed: Array<{
      subject: string;
      from: string;
      amount: number | null;
      utr: string | null;
      orderMatched?: string;
      status: "PAID" | "SKIPPED" | "DUPLICATE_UTR" | "NO_ORDER_MATCH";
    }> = [];

    for (const email of emails) {
      if (!email.isUpiNotification || !email.amount || !email.utr) {
        processed.push({
          subject: email.subject,
          from: email.from,
          amount: email.amount,
          utr: email.utr,
          status: "SKIPPED",
        });
        continue;
      }

      const utrHash = hashUtr(email.utr);

      // Check UTR duplicate
      const { data: existingLedgerRaw } = await supabase
        .from("utr_ledger")
        .select("id, order_id")
        .eq("utr_hash", utrHash)
        .maybeSingle();

      if (existingLedgerRaw) {
        const ledger = existingLedgerRaw as LedgerRow;
        processed.push({
          subject: email.subject,
          from: email.from,
          amount: email.amount,
          utr: email.utr,
          orderMatched: ledger.order_id,
          status: "DUPLICATE_UTR",
        });
        continue;
      }

      // Find matching PENDING order with identical dynamic_amount
      const { data: orderRaw, error: orderError } = await supabase
        .from("orders")
        .select("*, vpas(*), api_keys(*)")
        .eq("dynamic_amount", email.amount)
        .eq("status", "PENDING")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (orderError || !orderRaw) {
        processed.push({
          subject: email.subject,
          from: email.from,
          amount: email.amount,
          utr: email.utr,
          status: "NO_ORDER_MATCH",
        });
        continue;
      }

      const order = orderRaw as OrderWithRelations;

      // Mark order PAID
      await supabase
        .from("orders")
        .update({
          status: "PAID",
          verified_via: "EMAIL",
          upi_utr: email.utr,
        })
        .eq("id", order.id);

      // Add to UTR ledger
      await supabase.from("utr_ledger").insert({
        utr_hash: utrHash,
        order_id: order.id,
        verified_at: new Date().toISOString(),
      });

      // Fire outbound webhook
      const clientKeyValue = order.api_keys?.key_value;
      if (clientKeyValue) {
        const paidOrder: OrderRow = {
          ...order,
          status: "PAID",
          verified_via: "EMAIL",
          upi_utr: email.utr,
        };
        fireHmacCallback(paidOrder, clientKeyValue).catch(console.error);
      }

      processed.push({
        subject: email.subject,
        from: email.from,
        amount: email.amount,
        utr: email.utr,
        orderMatched: order.id,
        status: "PAID",
      });
    }

    return NextResponse.json({
      success: true,
      scannedCount: emails.length,
      processed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/email-poll] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
