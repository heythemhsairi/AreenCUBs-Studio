"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Terminates the session for an authenticated-but-unprovisioned user.
 *
 * Lives in a server action rather than in the page body because Next.js
 * forbids cookie writes during a Server Component render, and `signOut()`
 * clears the auth cookies.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
