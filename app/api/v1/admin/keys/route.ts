import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminSession } from "@/lib/auth/middleware";
import { generateApiKey } from "@/lib/utils/utr";

const CreateKeySchema = z.object({
  keyName: z.string().min(1).max(100),
  keyType: z.enum(["CLIENT", "DEVICE"]),
});

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, key_name, key_type, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  let body;
  try {
    body = CreateKeySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: err }, { status: 400 });
  }

  const { keyName, keyType } = body;
  const prefix = keyType === "CLIENT" ? "client" : "device";
  const keyValue = generateApiKey(prefix);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("api_keys")
      .insert({ key_name: keyName, key_value: keyValue, key_type: keyType, is_active: true })
      .select("id, key_name, key_type, is_active, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        data: {
          ...(data as object),
          key_value: keyValue,
          warning: "Save this key now — it will not be shown again.",
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true, message: "API key revoked" }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
