import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ApiKey = Database["public"]["Tables"]["api_keys"]["Row"];

/**
 * Validates that the caller holds a valid Supabase admin session.
 * Returns a 401 response to propagate when unauthenticated.
 * proxy.ts only guards page routes (/admin/*), so API routes under
 * /api/v1/admin/* must enforce this check themselves.
 */
export async function requireAdminSession(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

/**
 * Validates the X-Client-Api-Key header.
 * Returns the API key record if valid, or throws a 401 response.
 */
export async function validateClientKey(
  req: NextRequest
): Promise<ApiKey> {
  const key = req.headers.get("X-Client-Api-Key");

  if (!key) {
    throw NextResponse.json(
      { error: "Missing X-Client-Api-Key header" },
      { status: 401 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_value", key)
    .eq("key_type", "CLIENT")
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw NextResponse.json(
      { error: "Invalid or revoked API key" },
      { status: 401 }
    );
  }

  return data;
}

/**
 * Validates the X-Device-Secret header.
 * Returns the API key record if valid, or throws a 401 response.
 */
export async function validateDeviceSecret(
  req: NextRequest
): Promise<ApiKey> {
  const secret = req.headers.get("X-Device-Secret");

  if (!secret) {
    throw NextResponse.json(
      { error: "Missing X-Device-Secret header" },
      { status: 401 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_value", secret)
    .eq("key_type", "DEVICE")
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw NextResponse.json(
      { error: "Invalid or revoked device secret" },
      { status: 401 }
    );
  }

  return data;
}

/**
 * Validates the CRON_SECRET header for cron job endpoints.
 */
export function validateCronSecret(req: NextRequest): void {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>";
  // external schedulers typically use "x-cron-secret". Accept both.
  const bearer = req.headers.get("authorization");
  const bearerSecret = bearer?.startsWith("Bearer ")
    ? bearer.slice("Bearer ".length).trim()
    : null;
  const headerSecret =
    req.headers.get("x-cron-secret") ?? bearerSecret;

  if (!headerSecret || headerSecret !== process.env.CRON_SECRET) {
    throw NextResponse.json(
      { error: "Unauthorized cron request" },
      { status: 401 }
    );
  }
}

/**
 * Helper to wrap route handlers with auth and proper error handling.
 * Usage: return withAuth(req, validateClientKey, async (key) => { ... })
 */
export async function withAuth<T extends ApiKey>(
  req: NextRequest,
  validator: (req: NextRequest) => Promise<T>,
  handler: (apiKey: T) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const apiKey = await validator(req);
    return await handler(apiKey);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[Auth Error]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
