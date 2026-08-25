import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Marks PENDING orders whose expires_at has passed as EXPIRED.
 *
 * The cron endpoint (/api/v1/cron/cleanup) calls this on schedule, but it
 * is ALSO invoked lazily on hot paths (order creation, admin stats/orders)
 * so the system self-heals even when no external cron is configured —
 * without it, stale PENDING rows block decimal slots and skew stats.
 */

const THROTTLE_MS = 30_000;
let lastRunAt = 0;

export async function expireOverdueOrders(): Promise<number> {
  // Throttle: at most one sweep per 30s across all callers
  if (Date.now() - lastRunAt < THROTTLE_MS) return -1;
  lastRunAt = Date.now();

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .update({ status: "EXPIRED" as const })
    .eq("status", "PENDING")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("[sweeper] Failed to expire overdue orders:", error);
    return 0;
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[sweeper] Expired ${count} overdue order(s)`);
  }
  return count;
}
