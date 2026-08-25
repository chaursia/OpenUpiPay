import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateDeviceSecret } from "@/lib/auth/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { hashUtr } from "@/lib/utils/utr";
import { fireHmacCallback } from "@/lib/payment/webhook";
import type { OrderRow, ApiKeyRow, VerifiedVia } from "@/types/database";

const WebhookSchema = z.object({
  amount: z.number().positive(),
  rawText: z.string().min(1),
  utr: z
    .string()
    .regex(/^\d{12}$/, "UTR must be exactly 12 numeric digits"),
  deviceName: z.string().optional(),
  deviceType: z.enum(["TERMUX", "APP"]).optional(),
  // Originating address from the device (e.g. "JD-PNBSMS-S" for DLT SMS)
  sender: z.string().max(32).optional(),
});

// ── TRAI DLT sender-header validation (anti-spoofing) ──────────────
// Indian transactional SMS arrive from headers like "JD-PNBSMS-S":
//   {2-letter operator prefix}-{sender id}-{message class suffix}
// Only Transactional (T) and Service (S) classes are trusted. Plain
// numbers, headerless senders, and Promotional/Government (P/G) are
// rejected so a crafted SMS can never confirm a payment.
const DLT_HEADER = /^[A-Z]{2}-[A-Z0-9]{3,8}-([A-Z])$/;

export function trustedBankSender(
  sender: string | undefined,
  rawText: string
): boolean {
  const candidate = (sender ?? "").trim().toUpperCase();

  if (candidate.includes("-")) {
    const match = DLT_HEADER.exec(candidate);
    if (!match) return false;
    return match[1] === "T" || match[1] === "S";
  }

  // Fallback: some devices strip the sender column — look for the
  // header token at the start of the message body instead.
  const embedded = /\b([A-Z]{2}-[A-Z0-9]{3,8}-([TS]))\b/.exec(
    rawText.toUpperCase().slice(0, 120)
  );
  return !!embedded;
}

type OrderWithRelations = OrderRow & {
  vpas?: { vpa_address: string; payee_name: string } | null;
  api_keys?: ApiKeyRow | null;
};

type LedgerRow = { id: string; order_id: string };

export async function handlePaymentWebhook(
  req: NextRequest,
  channel: VerifiedVia
): Promise<NextResponse> {
  try {
    await validateDeviceSecret(req);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  let body;
  try {
    body = WebhookSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: err }, { status: 400 });
  }

  const { amount, utr, deviceName, deviceType, sender } = body;

  // SMS spoofing defence: only TRAI DLT Transactional/Service headers.
  // (Email and app-notification channels are exempt — no DLT headers.)
  if (channel === "SMS" && !trustedBankSender(sender, body.rawText)) {
    return NextResponse.json(
      {
        success: false,
        ignored: true,
        error:
          "Ignored: sender is not a TRAI DLT Transactional/Service header (expected XX-XXXXXX-T or -S)",
        code: "UNTRUSTED_SENDER",
      },
      { status: 422 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const utrHash = hashUtr(utr);

    const { data: existingLedgerRaw } = await supabase
      .from("utr_ledger")
      .select("id, order_id")
      .eq("utr_hash", utrHash)
      .maybeSingle();

    if (existingLedgerRaw) {
      const ledger = existingLedgerRaw as LedgerRow;
      return NextResponse.json(
        { success: true, message: "UTR already processed", orderId: ledger.order_id },
        { status: 200 }
      );
    }

    const { data: orderRaw, error: orderError } = await supabase
      .from("orders")
      .select("*, vpas(*), api_keys(*)")
      .eq("dynamic_amount", amount)
      .eq("status", "PENDING")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (orderError || !orderRaw) {
      return NextResponse.json(
        { error: "No matching PENDING order found for this amount" },
        { status: 404 }
      );
    }

    const order = orderRaw as OrderWithRelations;

    // Atomically insert the UTR ledger row and transition PENDING -> PAID
    // in a single DB transaction (see migration 003). Prevents duplicate
    // credits when SMS/Email/OCR confirmations race each other.
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_order_payment",
      {
        p_order_id: order.id,
        p_channel: channel,
        p_utr: utr,
        p_utr_hash: utrHash,
      }
    );

    if (claimError) {
      throw new Error(`Failed to claim order payment: ${claimError.message}`);
    }

    if (claimed !== true) {
      // Either the UTR was used concurrently or this order was just
      // settled by another channel. Report idempotent success if the
      // UTR is already in the ledger, otherwise a conflict.
      const { data: dupeLedger } = await supabase
        .from("utr_ledger")
        .select("order_id")
        .eq("utr_hash", utrHash)
        .maybeSingle();

      if (dupeLedger) {
        return NextResponse.json(
          { success: true, message: "UTR already processed", orderId: (dupeLedger as LedgerRow).order_id },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: "Order is no longer claimable (already paid or expired)" },
        { status: 409 }
      );
    }

    if (deviceName) {
      const telemetryPayload: Record<string, unknown> = {
        device_name: deviceName,
        last_ping_at: new Date().toISOString(),
        status: "ONLINE",
      };
      if (deviceType) telemetryPayload.device_type = deviceType;

      await supabase
        .from("device_telemetry")
        .upsert(telemetryPayload, { onConflict: "device_name" });
    }

    const clientKeyValue = order.api_keys?.key_value;
    if (clientKeyValue) {
      const paidOrder: OrderRow = { ...order, status: "PAID", verified_via: channel, upi_utr: utr };
      fireHmacCallback(paidOrder, clientKeyValue).catch(console.error);
    }

    return NextResponse.json(
      { success: true, message: `Payment verified via ${channel}`, orderId: order.id, orderIdExt: order.order_id_ext },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${channel} Webhook Error]`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
