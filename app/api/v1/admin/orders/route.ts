import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminSession } from "@/lib/auth/middleware";
import { expireOverdueOrders } from "@/lib/payment/sweeper";

/**
 * GET /api/v1/admin/orders
 * Paginated orders with status filter and search.
 * Query params: limit, offset, status, search
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  // Self-healing sweep so the table reflects true expiry states
  await expireOverdueOrders();

  const url    = new URL(req.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit")  ?? "20"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim();

  try {
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("orders")
      .select("*, vpas(vpa_address, payee_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "ALL") {
      query = query.eq("status", status as never);
    }

    if (search) {
      // search by order_id_ext or upi_utr
      query = query.or(`order_id_ext.ilike.%${search}%,upi_utr.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data, total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
