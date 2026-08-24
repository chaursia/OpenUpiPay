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
  utr: z.string().min(12).max(20),
  deviceName: z.string().optional(),
});

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

  const { amount, utr, deviceName } = body;

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

    await supabase
      .from("orders")
      .update({ status: "PAID", verified_via: channel, upi_utr: utr })
      .eq("id", order.id);

    await supabase.from("utr_ledger").insert({
      utr_hash: utrHash,
      order_id: order.id,
      verified_at: new Date().toISOString(),
    });

    if (deviceName) {
      await supabase
        .from("device_telemetry")
        .upsert(
          { device_name: deviceName, last_ping_at: new Date().toISOString(), status: "ONLINE" },
          { onConflict: "device_name" }
        );
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
