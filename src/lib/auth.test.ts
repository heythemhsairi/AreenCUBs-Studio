import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Authentication behaviour matrix.
 *
 * `requireSession` is the single authorization entry point for every dashboard
 * route and every server action, so its failure mode matters more than that of
 * any individual page. Before this suite existed the function failed OPEN: an
 * authenticated user with no `profiles` row was silently handed
 * `role: "freelancer"`.
 *
 * `redirect()` from next/navigation throws to unwind the render, so it is
 * mocked to throw a tagged error the assertions can inspect. That mirrors the
 * real control flow: reaching a redirect means the function never returns.
 */

class RedirectError extends Error {
  constructor(public readonly to: string) {
    super(`REDIRECT:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to);
  },
}));

const getUser = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  }),
}));

import { requireSession, requireAdmin, requireWorkerOrAdmin, isValidRole, VALID_ROLES, ACCOUNT_UNAVAILABLE_ROUTE } from "./auth";

const USER = { id: "user-uuid-1", email: "sana@areencubs.studio" };

function signedInAs(profile: Record<string, unknown> | null) {
  getUser.mockResolvedValue({ data: { user: USER } });
  maybeSingle.mockResolvedValue({ data: profile });
}

function signedOut() {
  getUser.mockResolvedValue({ data: { user: null } });
  maybeSingle.mockResolvedValue({ data: null });
}

/** Captures the redirect target, or returns null if the call returned normally. */
async function redirectTargetOf(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof RedirectError) return e.to;
    throw e;
  }
}

const adminProfile = {
  id: USER.id,
  username: "sana",
  full_name: "Sana B.",
  role: "admin",
  avatar_url: null,
  job_title: "CEO",
};

const workerProfile = { ...adminProfile, username: "omar", full_name: "Omar K.", role: "worker", job_title: null };
const freelancerProfile = { ...workerProfile, username: "nadia", role: "freelancer" };

beforeEach(() => {
  getUser.mockReset();
  maybeSingle.mockReset();
});

// ── The matrix ───────────────────────────────────────────────────────────────

describe("requireSession — no session", () => {
  it("redirects to /login", async () => {
    signedOut();
    expect(await redirectTargetOf(requireSession)).toBe("/login");
  });

  it("never queries the profiles table without a user", async () => {
    signedOut();
    await redirectTargetOf(requireSession);
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});

describe("requireSession — valid administrator profile", () => {
  it("returns the profile with the admin role", async () => {
    signedInAs(adminProfile);
    const s = await requireSession();
    expect(s.role).toBe("admin");
    expect(s.username).toBe("sana");
    expect(s.id).toBe(USER.id);
    expect(s.email).toBe(USER.email);
    expect(s.job_title).toBe("CEO");
  });
});

describe("requireSession — valid worker profile", () => {
  it("returns the profile with the worker role", async () => {
    signedInAs(workerProfile);
    const s = await requireSession();
    expect(s.role).toBe("worker");
    expect(s.full_name).toBe("Omar K.");
  });

  it("normalises a missing job title to null", async () => {
    signedInAs({ ...workerProfile, job_title: undefined });
    const s = await requireSession();
    expect(s.job_title).toBeNull();
  });
});

describe("requireSession — authenticated user with NO profile (the fail-open defect)", () => {
  it("denies access instead of granting freelancer", async () => {
    signedInAs(null);
    expect(await redirectTargetOf(requireSession)).toBe(ACCOUNT_UNAVAILABLE_ROUTE);
  });

  it("does not return a synthesized session", async () => {
    signedInAs(null);
    let returned: unknown = "sentinel";
    try {
      returned = await requireSession();
    } catch {
      returned = "denied";
    }
    expect(returned).toBe("denied");
  });

  it("denies rather than bouncing to /login, which the middleware would loop", async () => {
    signedInAs(null);
    const target = await redirectTargetOf(requireSession);
    expect(target).not.toBe("/login");
    expect(target).toBe("/account-unavailable");
  });

  it("does not attempt to create the missing profile", async () => {
    // Auto-provisioning would turn an auth failure into a privilege grant.
    // Only auth.getUser and the profile SELECT may be called.
    signedInAs(null);
    await redirectTargetOf(requireSession);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});

describe("requireSession — invalid or unknown role", () => {
  it.each([
    ["superuser", "a role that does not exist in this build"],
    ["", "an empty string"],
    ["ADMIN", "a case-mismatched role"],
    ["administrator", "the matrix's English name for a role stored as 'admin'"],
    ["staff", "a plausible-sounding role that is not in the enum"],
  ])("denies %s (%s)", async (role) => {
    signedInAs({ ...workerProfile, role });
    expect(await redirectTargetOf(requireSession)).toBe(ACCOUNT_UNAVAILABLE_ROUTE);
  });

  it.each([null, undefined, 42, {}])("denies a non-string role: %s", async (role) => {
    signedInAs({ ...workerProfile, role });
    expect(await redirectTargetOf(requireSession)).toBe(ACCOUNT_UNAVAILABLE_ROUTE);
  });

  it("does not silently downgrade an unknown role to freelancer", async () => {
    signedInAs({ ...workerProfile, role: "superuser" });
    let outcome: unknown;
    try {
      outcome = (await requireSession()).role;
    } catch {
      outcome = "denied";
    }
    expect(outcome).toBe("denied");
  });
});

describe("requireSession — disabled users", () => {
  /**
   * The `profiles` table has no is_active / disabled / deleted_at column, so
   * application-level disabling is NOT currently supported. Adding one is a
   * schema change and therefore out of scope here.
   *
   * Supabase Auth-level banning IS supported today: a banned user's
   * getUser() returns no user, which lands on the no-session path below.
   */
  it("denies a user banned at the auth level, via the no-session path", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await redirectTargetOf(requireSession)).toBe("/login");
  });

  it("documents that profile-level disabling is not yet supported", () => {
    expect(Object.keys(adminProfile)).not.toContain("is_active");
  });
});

// ── Role gates built on top ──────────────────────────────────────────────────

describe("requireAdmin", () => {
  it("admits an administrator", async () => {
    signedInAs(adminProfile);
    expect((await requireAdmin()).role).toBe("admin");
  });

  it.each([
    ["worker", workerProfile],
    ["freelancer", freelancerProfile],
  ])("sends a %s back to the dashboard", async (_label, profile) => {
    signedInAs(profile);
    expect(await redirectTargetOf(requireAdmin)).toBe("/dashboard");
  });

  it("denies an unprovisioned user before the role check runs", async () => {
    signedInAs(null);
    expect(await redirectTargetOf(requireAdmin)).toBe(ACCOUNT_UNAVAILABLE_ROUTE);
  });

  it("redirects to login when there is no session", async () => {
    signedOut();
    expect(await redirectTargetOf(requireAdmin)).toBe("/login");
  });
});

describe("requireWorkerOrAdmin", () => {
  it.each([
    ["admin", adminProfile],
    ["worker", workerProfile],
  ])("admits a %s", async (role, profile) => {
    signedInAs(profile);
    expect((await requireWorkerOrAdmin()).role).toBe(role);
  });

  it("sends a freelancer back to the dashboard", async () => {
    signedInAs(freelancerProfile);
    expect(await redirectTargetOf(requireWorkerOrAdmin)).toBe("/dashboard");
  });

  it("denies an unprovisioned user", async () => {
    signedInAs(null);
    expect(await redirectTargetOf(requireWorkerOrAdmin)).toBe(ACCOUNT_UNAVAILABLE_ROUTE);
  });
});

// ── Role allow-list ──────────────────────────────────────────────────────────

describe("isValidRole", () => {
  it("accepts exactly the roles in the user_role enum", () => {
    expect(VALID_ROLES).toEqual([
      "admin",
      "worker",
      "freelancer",
      "commercial",
      "intern",
      "client",
    ]);
    for (const r of VALID_ROLES) expect(isValidRole(r)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const v of ["superuser", "Admin", "", null, undefined, 0, {}, []]) {
      expect(isValidRole(v)).toBe(false);
    }
  });
});
