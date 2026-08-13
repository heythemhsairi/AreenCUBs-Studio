import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service_role key.
// Bypasses Row-Level Security. NEVER import from client components or
// pages that ship to the browser. The "import server-only" guard ensures
// this module is tree-shaken out of any client bundle.
import "server-only";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The same client, or `null` when the service-role key is absent.
 *
 * For the narrow case where elevated access ENRICHES a page rather than
 * carrying it. `/dashboard/team` reads its members through ordinary RLS and
 * then reaches for the Auth admin API purely to attach each member's email
 * address, which lives in `auth.users` and nowhere else. When the key was
 * missing, `createAdminClient()` threw during the server render and the entire
 * route returned a 500 — the whole team directory lost to one display column.
 *
 * Callers that MUTATE must keep using `createAdminClient()` and fail loudly.
 * Creating a user, resetting a password or deleting an account without the
 * service role is impossible, and degrading those would turn a configuration
 * error into a silent no-op. Reads degrade; writes do not.
 */
export function createAdminClientOrNull() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createAdminClient();
}
