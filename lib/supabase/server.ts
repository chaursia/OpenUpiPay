import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Intentionally untyped Supabase client.
// Row-level types are enforced via explicit casts at each call-site
// using the types in types/database.ts.
// This avoids version-specific generic constraint mismatches between
// @supabase/ssr and hand-authored Database types.

type SupabaseClient = ReturnType<typeof createServerClient>;

/**
 * Creates a Supabase admin client for API routes.
 * Uses SERVICE_ROLE_KEY- bypasses RLS. Never expose to browser.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

/**
 * Creates a cookie-aware Supabase client for Server Components.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component- cookie mutations are expected to fail
          }
        },
      },
    }
  );
}
