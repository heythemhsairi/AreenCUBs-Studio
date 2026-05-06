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
