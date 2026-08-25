import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateDeviceSecret } from "@/lib/auth/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { hashUtr } from "@/lib/utils/utr";
import type { OrderRow } from "@/types/database";

/**
 * POST /api/v1/webhook/app-event
 *
 * THIRD confirmation channel: the Android agent forwards payment
 * notifications intercepted from UPI apps (PhonePe, Paytm, GPay, Navi,
 * Slice, ...). Every event is stored; when an amount is present and
 * matches exactly one PENDING order, the order is confirmed as PAID via
 * verified_via = 'APP' (same atomic claim used by SMS/Email).
 *
 * Header: X-Device-Secret
 */
const AppEventSchema = z.object({
  deviceName: z.string().min(1).max(100),
  appName: z.string().min(1).max(60),
  packageName: z.string().max(120).optional(),
  title: z.string().max(200).optional(),
  body: z.string().max(1000).optional(),
  amount: z.number().positive().optional(),
  occurredAt: z.string().datetime().optional(),
});

type EventWithRelations = OrderRow & {
  api_keys?: { key_value: string } | null;
};

export async function POST(req: NextRequest) {
  try {
    await validateDeviceSecret(req);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  let body;
  try {
    body = AppEventSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    // ── 1. Store the event (audit trail + future matching) ────
    const occurredAt = body.occurredAt ?? new Date().toISOString();

    const { data: eventRaw, error: insertError } = await supabase
      .from("app_payment_events")
      .insert({
        device_name: body.deviceName,
        app_name: body.appName,
        package_name: body.packageName ?? null,
        title: body.title ?? null,
        body: body.body ?? null,
        amount: body.amount ?? null,
        occurred_at: occurredAt,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    const eventId = (eventRaw as { id: string }).id;

    // ── 2. Try to confirm a PENDING order by exact amount ─────
    let claimedOrderId: string | null = null;
    let orderIdExt: string | null = null;

    if (body.amount) {
      const { data: orderRaw, error: orderError } = await supabase
        .from("orders")
        .select("*, api_keys(key_value)")
        .eq("dynamic_amount", body.amount)
        .eq("status", "PENDING")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!orderError && orderRaw) {
        const order = orderRaw as EventWithRelations;

        // Synthetic UTR derived from the event id → ledger UNIQUE keeps
        // replays of the same notification idempotent.
        const syntheticUtr = `APPEVT-${eventId.replace(/-/g, "").slice(0, 18)}`;
        const utrHash = hashUtr(syntheticUtr);

        const { data: claimed, error: claimError } = await supabase.rpc(
          "claim_order_payment",
          {
            p_order_id: order.id,
            p_channel: "APP",
            p_utr: syntheticUtr,
            p_utr_hash: utrHash,
          }
        );

        if (claimError) throw claimError;

        if (claimed === true) {
          claimedOrderId = order.id;
          orderIdExt = order.order_id_ext;
          console.log(
            `[app-event] order ${order.id} confirmed via ${body.appName} (amount ${body.amount})`
          );

          // Fire merchant webhook if configured- same contract as SMS path
          const clientKeyValue =
            (order as EventWithRelations).api_keys?.key_value ?? null;
          if (clientKeyValue) {
            const { fireHmacCallback } = await import("@/lib/payment/webhook");
            fireHmacCallback(
              { ...order, status: "PAID", verified_via: "APP", upi_utr: syntheticUtr },
              clientKeyValue
            ).catch(console.error);
          }
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        stored: true,
        eventId,
        claimed: claimedOrderId !== null,
        orderId: claimedOrderId,
        orderIdExt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[app-event]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
