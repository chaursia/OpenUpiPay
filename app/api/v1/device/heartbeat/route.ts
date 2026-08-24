import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateDeviceSecret } from "@/lib/auth/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const HeartbeatSchema = z.object({
  deviceName: z.string().min(1).max(100),
  metadata: z
    .object({
      battery: z.number().min(0).max(100).optional(),
      networkType: z.string().optional(),
      appVersion: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    await validateDeviceSecret(req);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  let body;
  try {
    body = HeartbeatSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err },
      { status: 400 }
    );
  }

  const { deviceName } = body;
  const now = new Date().toISOString();

  try {
    const supabase = createSupabaseAdminClient();

    await supabase
      .from("device_telemetry")
      .upsert(
        {
          device_name: deviceName,
          last_ping_at: now,
          status: "ONLINE" as const,
        },
        { onConflict: "device_name" }
      );

    return NextResponse.json(
      { success: true, serverTime: now, offlineThresholdSeconds: 90 },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[heartbeat]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
