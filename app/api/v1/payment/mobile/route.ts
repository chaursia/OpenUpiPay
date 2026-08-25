import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/payment/mobile
 *
 * Public endpoint called by the hosted checkout BEFORE revealing the QR.
 * Stores the payer's mobile number against the order for reconciliation.
 * The orderId is an unguessable UUID; only non-sensitive data is writable.
 */
const MobileSchema = z.object({
  orderId: z.string().uuid(),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
});

export async function POST(req: NextRequest) {
  let body;
  try {
    body = MobileSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request", details: err },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from("orders")
      .update({ customer_mobile: body.mobile })
      .eq("id", body.orderId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[payment-mobile]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
