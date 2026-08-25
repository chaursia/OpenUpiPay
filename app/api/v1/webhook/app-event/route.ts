import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateDeviceSecret } from "@/lib/auth/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/webhook/app-event
 *
 * Secondary confirmation channel: the Android agent forwards payment
 * notifications intercepted from UPI apps (PhonePe, Paytm, GPay, Navi,
 * Slice, ...) that the operator registered. Events are stored and later
 * cross-checked against SMS claims for extra confidence.
 *
 * Header: X-Device-Secret
 */
const AppEventSchema = z.object({
  deviceName: z.string().min(1).max(100),
  appName: z.string().min(1).max(60),
  packageName: z.string().max(120).optional(),
  title: z.string().max(200).optional(),
  body: z.string().max(1000).optional(),
  amount: z.number().positive().optional(),
  occurredAt: z.string().datetime().optional(),
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
    body = AppEventSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase.from("app_payment_events").insert({
      device_name: body.deviceName,
      app_name: body.appName,
      package_name: body.packageName ?? null,
      title: body.title ?? null,
      body: body.body ?? null,
      amount: body.amount ?? null,
      occurred_at: body.occurredAt ?? new Date().toISOString(),
    });

    if (error) throw error;

    return NextResponse.json({ success: true, stored: true }, { status: 201 });
  } catch (err) {
    console.error("[app-event]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
