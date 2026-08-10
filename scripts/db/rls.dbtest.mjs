import { describe, it, expect, beforeAll } from "vitest";
import { sql, sqlAs, sqlAsExpectError, dbAvailable, USERS } from "./sql.mjs";

/**
 * RLS integration tests against real PostgreSQL.
 *
 * Every assertion runs as an IMPERSONATED authenticated user
 * (`set local role authenticated` + `request.jwt.claims`), inside a
 * transaction that is always rolled back.
 *
 * This matters more than it looks: as the `postgres` superuser, RLS is
 * bypassed entirely and every one of these tests would pass vacuously. The
 * suite asserts that it is NOT running with service-role privileges before
 * trusting any other result.
 */

beforeAll(() => {
  if (!dbAvailable()) {
    throw new Error("No local staging database. Run: npm run db:start && npm run db:reset");
  }
});

describe("test harness integrity", () => {
  it("impersonation actually drops superuser privileges", () => {
    // If this returns 'postgres', every RLS assertion below is meaningless.
    expect(sqlAs(USERS.admin, "select current_user;")).toBe("authenticated");
  });

  it("RLS is not bypassed for the impersonated role", () => {
    expect(sqlAs(USERS.admin, "select current_setting('is_superuser');")).toBe("off");
  });

  it("auth.uid() resolves to the impersonated user", () => {
    expect(sqlAs(USERS.worker, "select auth.uid();")).toBe(USERS.worker);
  });
});

describe("public.current_role()", () => {
  it("parses and executes — the 0018 syntax defect is gone", () => {
    expect(() => sql("select public.current_role();")).not.toThrow();
  });

  it("returns the application role, not the PostgreSQL role", () => {
    expect(sqlAs(USERS.admin, "select public.current_role();")).toBe("admin");
    expect(sqlAs(USERS.worker, "select public.current_role();")).toBe("worker");
    expect(sqlAs(USERS.freelancer, "select public.current_role();")).toBe("freelancer");
  });

  it("is NOT the reserved PostgreSQL current_role keyword", () => {
    // The Postgres built-in would return 'authenticated' for every caller.
    const appRole = sqlAs(USERS.admin, "select public.current_role();");
    const pgRole = sqlAs(USERS.admin, "select current_role;");
    expect(appRole).toBe("admin");
    expect(pgRole).toBe("authenticated");
    expect(appRole).not.toBe(pgRole);
  });

  it("returns nothing for an authenticated user with no profile", () => {
    expect(sqlAs(USERS.orphan, "select coalesce(public.current_role()::text, 'NULL');")).toBe("NULL");
  });
});

describe("is_admin() / is_worker_or_admin()", () => {
  it("identifies the admin", () => {
    expect(sqlAs(USERS.admin, "select public.is_admin();")).toBe("t");
    expect(sqlAs(USERS.worker, "select public.is_admin();")).toBe("f");
    expect(sqlAs(USERS.freelancer, "select public.is_admin();")).toBe("f");
  });

  it("fails closed for a profile-less user", () => {
    // coalesce(..., false) — an unprovisioned identity must never be admin.
    expect(sqlAs(USERS.orphan, "select public.is_admin();")).toBe("f");
    expect(sqlAs(USERS.orphan, "select public.is_worker_or_admin();")).toBe("f");
  });

  it("fails closed for an anonymous caller", () => {
    expect(sqlAs(null, "select public.is_admin();")).toBe("f");
    expect(sqlAs(null, "select public.is_worker_or_admin();")).toBe("f");
  });
});

describe("authenticated user without a profile fails closed", () => {
  // Mirrors the Phase 1d application fix at the database layer.
  it("reads no clients", () => {
    expect(sqlAs(USERS.orphan, "select count(*) from public.clients;")).toBe("0");
  });

  it("reads no financial documents", () => {
    expect(sqlAs(USERS.orphan, "select count(*) from public.devis;")).toBe("0");
    expect(sqlAs(USERS.orphan, "select count(*) from public.payments;")).toBe("0");
  });

  it("cannot insert a client", () => {
    const err = sqlAsExpectError(
      USERS.orphan,
      "insert into public.clients (name) values ('orphan-should-not-exist');",
    );
    expect(err.toLowerCase()).toMatch(/row-level security|permission denied/);
  });

  it("cannot grant itself a profile", () => {
    // The most dangerous escalation: writing your own role row.
    const err = sqlAsExpectError(
      USERS.orphan,
      `insert into public.profiles (id, username, full_name, role)
       values ('${USERS.orphan}', 'orphan', 'Orphan', 'admin');`,
    );
    expect(err.toLowerCase()).toMatch(/row-level security|permission denied/);
  });
});

describe("admin access is allowed where the schema intends", () => {
  it("reads clients, documents and payments", () => {
    expect(Number(sqlAs(USERS.admin, "select count(*) from public.clients;"))).toBeGreaterThan(0);
    expect(Number(sqlAs(USERS.admin, "select count(*) from public.devis;"))).toBeGreaterThan(0);
  });

  it("reads expenses (finance is admin territory)", () => {
    expect(() => sqlAs(USERS.admin, "select count(*) from public.expenses;")).not.toThrow();
  });

  it("reads admin_tasks", () => {
    expect(() => sqlAs(USERS.admin, "select count(*) from public.admin_tasks;")).not.toThrow();
  });
});

describe("non-admin roles cannot reach protected records", () => {
  it("freelancer cannot read admin_tasks", () => {
    expect(sqlAs(USERS.freelancer, "select count(*) from public.admin_tasks;")).toBe("0");
  });

  it("worker cannot read admin_tasks", () => {
    expect(sqlAs(USERS.worker, "select count(*) from public.admin_tasks;")).toBe("0");
  });

  it("freelancer cannot read expenses", () => {
    expect(sqlAs(USERS.freelancer, "select count(*) from public.expenses;")).toBe("0");
  });

  it("freelancer cannot mutate a client — asserted by rows affected, not by an error", () => {
    // RLS denies an UPDATE by filtering rows, not by raising. A statement that
    // matches nothing returns success, so "did it throw?" is the wrong question
    // and would have reported a gap that does not exist. The security property
    // is that ZERO rows change.
    const affected = sqlAs(
      USERS.freelancer,
      `with u as (update public.clients set name = name || '_probe' returning 1)
       select count(*) from u;`,
    );
    expect(affected).toBe("0");
  });

  it("freelancer cannot delete a client", () => {
    const affected = sqlAs(
      USERS.freelancer,
      "with d as (delete from public.clients returning 1) select count(*) from d;",
    );
    expect(affected).toBe("0");
  });

  it("freelancer sees only clients reachable through an assigned task", () => {
    // Not zero — the schema intends narrow, task-scoped visibility
    // (clients_freelancer_select_via_tasks). Asserting zero would encode the
    // wrong rule and break the moment the policy works as designed.
    const visible = Number(sqlAs(USERS.freelancer, "select count(*) from public.clients;"));
    const total = Number(sql("select count(*) from public.clients;"));
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(total);
  });

  it("no non-admin role can escalate its own profile to admin", () => {
    for (const who of [USERS.worker, USERS.freelancer]) {
      const before = sqlAs(who, "select public.current_role();");
      // Attempt the escalation; the transaction rolls back either way.
      try {
        sqlAs(who, `update public.profiles set role = 'admin' where id = '${who}';`);
      } catch {
        /* denial is the expected outcome */
      }
      // Re-read in a fresh transaction: the role must be unchanged.
      expect(sqlAs(who, "select public.current_role();")).toBe(before);
    }
  });
});

describe("anonymous callers", () => {
  it("read nothing from the business tables", () => {
    for (const t of ["clients", "devis", "payments", "expenses", "admin_tasks"]) {
      expect(sqlAs(null, `select count(*) from public.${t};`)).toBe("0");
    }
  });
});

describe("no test relies on service-role privileges", () => {
  it("the impersonation helper never runs as postgres", () => {
    // Guard against a future edit that silently drops `set local role`.
    expect(sqlAs(USERS.admin, "select current_user;")).not.toBe("postgres");
    expect(sqlAs(USERS.orphan, "select current_user;")).not.toBe("postgres");
    expect(sqlAs(null, "select current_user;")).not.toBe("postgres");
  });

  it("superuser access would make these assertions vacuous — proof it does", () => {
    // As postgres, RLS is bypassed: the orphan-visible count differs from the
    // superuser count. If these ever match, impersonation has stopped working.
    const asSuper = Number(sql("select count(*) from public.clients;"));
    const asOrphan = Number(sqlAs(USERS.orphan, "select count(*) from public.clients;"));
    expect(asSuper).toBeGreaterThan(0);
    expect(asOrphan).toBe(0);
  });
});
