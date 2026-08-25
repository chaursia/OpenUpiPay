import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminSession } from "@/lib/auth/middleware";
import { expireOverdueOrders } from "@/lib/payment/sweeper";

/**
 * GET /api/v1/admin/stats
 * Aggregate order counts by status + collected amount for the
 * dashboard summary cards.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  try {
    // Self-healing sweep so cards never count stale PENDING orders
    await expireOverdueOrders();

    const supabase = createSupabaseAdminClient();

    // Head-count queries are cheap and exact
    const countFor = async (status?: string): Promise<number> => {
      let q = supabase.from("orders").select("id", { count: "exact", head: true });
      if (status) q = q.eq("status", status as never);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    };

    const [total, pending, paid, expired, manual, partial] = await Promise.all([
      countFor(),
      countFor("PENDING"),
      countFor("PAID"),
      countFor("EXPIRED"),
      countFor("MANUAL_VERIFICATION"),
      countFor("PARTIAL_PAID"),
    ]);

    // Collected amount across settled orders
    const { data: paidRows, error: sumError } = await supabase
      .from("orders")
      .select("dynamic_amount")
      .in("status", ["PAID", "PARTIAL_PAID"]);

    if (sumError) throw sumError;

    const paidAmount = ((paidRows ?? []) as { dynamic_amount: number }[]).reduce(
      (acc: number, r: { dynamic_amount: number }) => acc + Number(r.dynamic_amount),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        total,
        pending,
        paid,
        expired,
        manual,
        partial,
        paidAmount,
      },
    });
  } catch (err) {
    console.error("[admin-stats]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
