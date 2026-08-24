import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminSession } from "@/lib/auth/middleware";

/**
 * GET /api/v1/admin/devices
 * Returns device telemetry rows for the InfraHealth dashboard module.
 *
 * Queried via the service-role client because RLS grants no direct
 * table access to browser sessions (see migration 002). The dashboard
 * must poll this endpoint instead of querying Supabase from the browser.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("device_telemetry")
      .select("*")
      .order("last_ping_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[admin-devices]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
