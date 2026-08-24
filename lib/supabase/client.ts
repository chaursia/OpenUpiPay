"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase browser client for Realtime subscriptions.
 * Uses the ANON key — safe for client-side.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
