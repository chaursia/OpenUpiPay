import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/payment/status/[orderId]
 *
 * Public status endpoint for the hosted /pay/[orderId] checkout page.
 * The browser cannot subscribe to order changes via Supabase Realtime
 * (RLS grants no SELECT to anon/authenticated roles), so the page polls
 * this endpoint instead. Exposes only non-sensitive fields; the orderId
 * is an unguessable UUID.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await ctx.params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("orders")
      .select("id, status, expires_at, return_url")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Local expiry projection — don't wait for the cleanup cron
    const expired =
      (data as { status: string }).status === "PENDING" &&
      new Date((data as { expires_at: string }).expires_at).getTime() < Date.now();

    return NextResponse.json({
      success: true,
      data: {
        orderId: (data as { id: string }).id,
        status: expired ? "EXPIRED" : (data as { status: string }).status,
        expiresAt: (data as { expires_at: string }).expires_at,
        returnUrl: (data as { return_url: string | null }).return_url,
      },
    });
  } catch (err) {
    console.error("[payment-status]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
