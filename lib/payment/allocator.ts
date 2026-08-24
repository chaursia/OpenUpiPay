import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { VpaRow, OrderRow } from "@/types/database";

/**
 * Finds an unused decimal suffix (.01–.99) for the given base amount.
 */
export async function allocateDynamicAmount(
  baseAmount: number
): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { data: pendingOrders, error } = await supabase
    .from("orders")
    .select("dynamic_amount")
    .eq("status", "PENDING")
    .gte("dynamic_amount", baseAmount)
    .lt("dynamic_amount", baseAmount + 1);

  if (error) throw new Error(`DB error fetching orders: ${error.message}`);

  const rows = (pendingOrders ?? []) as Pick<OrderRow, "dynamic_amount">[];
  const usedDecimals = new Set(
    rows.map((o) => Math.round((o.dynamic_amount - baseAmount) * 100))
  );

  for (let decimal = 1; decimal <= 99; decimal++) {
    if (!usedDecimals.has(decimal)) {
      return parseFloat((baseAmount + decimal / 100).toFixed(2));
    }
  }

  throw new Error(`No decimal slots available for amount ${baseAmount}.`);
}

/**
 * Selects the least-loaded active VPA with capacity remaining.
 */
export async function selectVpa(): Promise<VpaRow> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("vpas")
    .select("*")
    .eq("is_active", true)
    .order("daily_tx_count", { ascending: true })
    .limit(10);

  if (error) throw new Error(`DB error fetching VPAs: ${error.message}`);

  const vpas = (data ?? []) as VpaRow[];
  const available = vpas.filter((v) => v.daily_tx_count < v.max_daily_limit);

  if (available.length === 0) {
    throw new Error("No VPA available. Daily limits reached.");
  }

  return available[0];
}

/**
 * Builds a UPI payment URI for QR code generation.
 */
export function buildUpiUri(
  vpaAddress: string,
  payeeName: string,
  amount: number,
  orderId: string
): string {
  const params = new URLSearchParams({
    pa: vpaAddress,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: `ORDER-${orderId}`,
  });
  return `upi://pay?${params.toString()}`;
}

/**
 * Generates expiry timestamp (default: 15 minutes from now).
 */
export function generateExpiresAt(minutesFromNow = 15): string {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}
