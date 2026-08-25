import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/auth/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { expireOverdueOrders } from "@/lib/payment/sweeper";

export async function POST(req: NextRequest) {
  try {
    validateCronSecret(req);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const results: Record<string, unknown> = {};

  // ── Job 1: Expire timed-out PENDING orders ────────────────
  results.expiredOrdersCount = await expireOverdueOrders();

  // ── Job 2: Reset VPA counts (midnight only) ───────────────
  const url = new URL(req.url);
  if (url.searchParams.get("resetVpas") === "true") {
    const { error: resetError } = await supabase
      .from("vpas")
      .update({ daily_tx_count: 0 })
      .gte("daily_tx_count", 0);

    if (resetError) {
      results.vpaResetError = resetError.message;
    } else {
      results.vpaCountsReset = true;
    }
  }

  // ── Job 3: Mark devices offline if no ping in 90s ────────
  const offlineThreshold = new Date(Date.now() - 90_000).toISOString();
  const { error: deviceError } = await supabase
    .from("device_telemetry")
    .update({ status: "OFFLINE" as const })
    .eq("status", "ONLINE")
    .lt("last_ping_at", offlineThreshold);

  if (deviceError) {
    results.deviceOfflineError = deviceError.message;
  } else {
    results.devicesChecked = true;
  }

  return NextResponse.json({ success: true, timestamp: now, jobs: results }, { status: 200 });
}
