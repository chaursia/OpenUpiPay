import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { fireHmacCallback } from "@/lib/payment/webhook";
import { hashUtr } from "@/lib/utils/utr";
import type { OrderRow, ApiKeyRow } from "@/types/database";

const ResolveSchema = z.object({
  orderId: z.string().uuid(),
  action: z.enum(["APPROVE", "REJECT"]),
});

type OrderWithKey = OrderRow & { api_keys?: ApiKeyRow | null };

export async function POST(req: NextRequest) {
  let body;
  try {
    body = ResolveSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: err }, { status: 400 });
  }

  const { orderId, action } = body;

  try {
    const supabase = createSupabaseAdminClient();

    const { data: orderRaw, error: fetchError } = await supabase
      .from("orders")
      .select("*, api_keys(*)")
      .eq("id", orderId)
      .eq("status", "MANUAL_VERIFICATION")
      .maybeSingle();

    if (fetchError || !orderRaw) {
      return NextResponse.json(
        { error: "Order not found or not in MANUAL_VERIFICATION status" },
        { status: 404 }
      );
    }

    const order = orderRaw as OrderWithKey;

    if (action === "APPROVE") {
      await supabase.from("orders").update({ status: "PAID" }).eq("id", orderId);

      if (order.upi_utr) {
        const utrHash = hashUtr(order.upi_utr);
        await supabase
          .from("utr_ledger")
          .upsert(
            { utr_hash: utrHash, order_id: orderId, verified_at: new Date().toISOString() },
            { onConflict: "utr_hash" }
          );
      }

      const clientKeyValue = order.api_keys?.key_value;
      if (clientKeyValue) {
        const paidOrder: OrderRow = { ...order, status: "PAID" };
        fireHmacCallback(paidOrder, clientKeyValue).catch(console.error);
      }

      return NextResponse.json({ success: true, message: "Order approved and marked as PAID" }, { status: 200 });
    } else {
      await supabase
        .from("orders")
        .update({ status: "EXPIRED", upi_utr: null, verified_via: null })
        .eq("id", orderId);

      return NextResponse.json({ success: true, message: "Order rejected and marked as EXPIRED" }, { status: 200 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/resolve]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
