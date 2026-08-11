import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INTERNAL_ROLES, type UserRole } from "@/lib/utils";

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
export const VALID_ROLES = [
  "admin",
  "worker",
  "freelancer",
  "commercial",
  "intern",
  "client",
] as const;

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

/**
 * Every guard below is an ALLOW-LIST, and that is the whole point.
 *
 * `requireWorkerOrAdmin` used to read `if (session.role === "freelancer")
 * redirect(...)` — a deny-list naming the one role that existed to exclude.
 * That is correct exactly until a new role appears, at which point it silently
 * admits it. Adding `commercial`, `intern` and `client` to the enum would have
 * handed all three the full internal application, including a client
 * organisation's contact reaching the agency's task board and price catalog.
 *
 * A deny-list fails open when the world changes. An allow-list fails closed.
 * A role that nobody has thought about yet reaches nothing.
 */

/** Where a signed-in principal goes when it holds no rights to the surface. */
function denyTo(role: UserRole): string {
  // A client has no dashboard to fall back to, so bouncing them to /dashboard
  // would loop against this same guard. They land on the portal instead, which
  // Phase 6 fills in; until then it is the account-unavailable page.
  return role === "client" ? "/portal" : "/dashboard";
}

export async function requireRoles(allowed: readonly UserRole[]): Promise<SessionProfile> {
  const session = await requireSession();
  if (!allowed.includes(session.role)) redirect(denyTo(session.role));
  return session;
}

export async function requireAdmin(): Promise<SessionProfile> {
  return requireRoles(["admin"]);
}

/**
 * Full internal operational access: the roles that run agency delivery.
 *
 * Mirrors `public.is_staff()` in the database. The name is kept because 26
 * call sites use it, but the semantics are now an allow-list.
 */
export async function requireWorkerOrAdmin(): Promise<SessionProfile> {
  return requireRoles(["admin", "worker"]);
}

/**
 * Any agency role. Excludes `client`, which is authenticated but external.
 * Mirrors `public.is_internal()`.
 */
export async function requireInternal(): Promise<SessionProfile> {
  return requireRoles(INTERNAL_ROLES);
}

/** The client portal. The inverse of requireInternal. */
export async function requireClientContact(): Promise<SessionProfile> {
  return requireRoles(["client"]);
}
