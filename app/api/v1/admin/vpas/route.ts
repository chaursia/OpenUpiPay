import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminSession } from "@/lib/auth/middleware";
import type { VpaRow } from "@/types/database";

const CreateVpaSchema = z.object({
  vpaAddress:    z.string().min(3).max(100).regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/, "Invalid UPI VPA format"),
  payeeName:     z.string().min(1).max(100),
  maxDailyLimit: z.number().int().min(1).max(500).optional().default(15),
});

const UpdateVpaSchema = z.object({
  id:            z.string().uuid(),
  payeeName:     z.string().min(1).max(100).optional(),
  maxDailyLimit: z.number().int().min(1).max(500).optional(),
  isActive:      z.boolean().optional(),
  resetCount:    z.boolean().optional(),
});

/** GET /api/v1/admin/vpas — list all VPAs */
export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vpas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data: data as VpaRow[] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST /api/v1/admin/vpas — add a new VPA */
export async function POST(req: NextRequest) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  let body;
  try {
    body = CreateVpaSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request", details: err }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vpas")
      .insert({
        vpa_address:     body.vpaAddress,
        payee_name:      body.payeeName,
        max_daily_limit: body.maxDailyLimit,
        is_active:       true,
        daily_tx_count:  0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: data as VpaRow }, { status: 201 });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/v1/admin/vpas — update a VPA (toggle active, edit limits, reset count) */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  let body;
  try {
    body = UpdateVpaSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request", details: err }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const updates: Record<string, unknown> = {};

    if (body.payeeName     !== undefined) updates.payee_name      = body.payeeName;
    if (body.maxDailyLimit !== undefined) updates.max_daily_limit = body.maxDailyLimit;
    if (body.isActive      !== undefined) updates.is_active       = body.isActive;
    if (body.resetCount)                  updates.daily_tx_count  = 0;

    const { data, error } = await supabase
      .from("vpas")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: data as VpaRow });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** DELETE /api/v1/admin/vpas?id=<uuid> — permanently delete a VPA */
export async function DELETE(req: NextRequest) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("vpas").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
