import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateClientKey } from "@/lib/auth/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { validateUtr, hashUtr } from "@/lib/utils/utr";
import type { OrderRow } from "@/types/database";

const SubmitUtrSchema = z.object({
  orderId: z.string().uuid(),
  utr: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    await validateClientKey(req);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  let body;
  try {
    body = SubmitUtrSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err },
      { status: 400 }
    );
  }

  const { orderId, utr } = body;
  const trimmedUtr = utr.trim();

  if (!validateUtr(trimmedUtr)) {
    return NextResponse.json(
      { error: "Invalid UTR. Must be exactly 12 numeric digits." },
      { status: 422 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: orderRaw, error: orderError } = await supabase
      .from("orders")
      .select("id, status, expires_at")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !orderRaw) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRaw as Pick<OrderRow, "id" | "status" | "expires_at">;

    if (order.status === "PAID") {
      return NextResponse.json({ error: "Order is already paid" }, { status: 409 });
    }
    if (order.status === "EXPIRED") {
      return NextResponse.json({ error: "Order has expired" }, { status: 410 });
    }
    if (!["PENDING", "PARTIAL_PAID"].includes(order.status)) {
      return NextResponse.json(
        { error: `Order is in status '${order.status}' and cannot accept UTR submission` },
        { status: 409 }
      );
    }

    const utrHash = hashUtr(trimmedUtr);

    const { data: existingLedger } = await supabase
      .from("utr_ledger")
      .select("id")
      .eq("utr_hash", utrHash)
      .maybeSingle();

    if (existingLedger) {
      return NextResponse.json(
        { error: "This UTR has already been submitted for another order" },
        { status: 409 }
      );
    }

    // Guarded transition: only claim if still in a submittable state.
    // Prevents overwriting a PAID status set by a concurrent webhook.
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "MANUAL_VERIFICATION" as const,
        upi_utr: trimmedUtr,
        verified_via: "MANUAL" as const,
      })
      .eq("id", orderId)
      .in("status", ["PENDING", "PARTIAL_PAID"])
      .select("id")
      .maybeSingle();

    if (updateError || !updatedOrder) {
      return NextResponse.json(
        { error: "Order state changed- it may already be paid or expired" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "UTR submitted for manual verification. An admin will review shortly.",
        orderId,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[submit-utr]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
