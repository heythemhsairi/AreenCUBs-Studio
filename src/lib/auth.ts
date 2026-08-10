import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/utils";

export type SessionProfile = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  job_title: string | null;
};

/**
 * Where an authenticated identity is sent when it cannot be resolved to a
 * valid principal.
 *
 * Deliberately NOT `/login`: the middleware redirects authenticated users away
 * from `/login` to `/dashboard`, so denying there would bounce the request
 * between the two routes indefinitely.
 */
export const ACCOUNT_UNAVAILABLE_ROUTE = "/account-unavailable";

/**
 * The complete set of roles the application recognises.
 *
 * Mirrors the `user_role` Postgres enum. A value read from the database that
 * is not in this list is treated as untrusted and denied rather than passed
 * through to callers, which would let an unrecognised role slip past
 * `role === "admin"`-style checks with undefined behaviour.
 */
export const VALID_ROLES = ["admin", "worker", "freelancer"] as const;

export function isValidRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Resolves the current request's authenticated principal.
 *
 * ── Fails closed ─────────────────────────────────────────────────────────────
 * This previously synthesised a profile with `role: "freelancer"` whenever the
 * `profiles` row was missing, so an auth user created without the matching
 * profile insert silently gained freelancer access. Because onboarding is a
 * two-step manual process (create the auth user, then run the SQL insert),
 * step two being skipped was a realistic operational error rather than a
 * hypothetical one.
 *
 * Access is now denied unless BOTH conditions hold:
 *   1. a session exists, and
 *   2. it resolves to a profile row carrying a recognised role.
 *
 * The missing profile is deliberately NOT created here. Auto-provisioning
 * would convert an authentication failure into a privilege grant, and it is
 * the administrator's decision what role a person should hold.
 */
export async function requireSession(): Promise<SessionProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session — includes users banned at the Supabase Auth level, for whom
  // getUser() returns no user.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, avatar_url, job_title")
    .eq("id", user.id)
    .maybeSingle();

  // Authenticated but not provisioned — deny.
  if (!profile) redirect(ACCOUNT_UNAVAILABLE_ROUTE);

  // Provisioned but carrying a role this build does not recognise — deny.
  // Treating an unknown role as a lesser one would be a guess about intent.
  if (!isValidRole(profile.role)) redirect(ACCOUNT_UNAVAILABLE_ROUTE);

  return {
    id: profile.id,
    email: user.email ?? "",
    username: profile.username,
    full_name: profile.full_name,
    role: profile.role,
    avatar_url: profile.avatar_url,
    job_title: profile.job_title ?? null,
  };
}

export async function requireAdmin(): Promise<SessionProfile> {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/dashboard");
  return session;
}

export async function requireWorkerOrAdmin(): Promise<SessionProfile> {
  const session = await requireSession();
  if (session.role === "freelancer") redirect("/dashboard");
  return session;
}
