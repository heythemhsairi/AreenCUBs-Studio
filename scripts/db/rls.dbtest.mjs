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

describe("collaboration hub containment", () => {
  it("exposes the mention directory to internal roles, never clients or unprovisioned identities", () => {
    expect(Number(sqlAs(USERS.worker, "select count(*) from public.studio_member_directory;"))).toBeGreaterThan(0);
    expect(sqlAs(USERS.client, "select count(*) from public.studio_member_directory;")).toBe("0");
    expect(sqlAs(USERS.orphan, "select count(*) from public.studio_member_directory;")).toBe("0");
  });

  it("keeps reminders private to their owner", () => {
    const result = sql(`
      begin;
      select set_config('request.jwt.claims', '{"sub":"${USERS.worker}","role":"authenticated"}', true);
      set local role authenticated;
      insert into public.reminders(owner_id,title,remind_at)
      values ('${USERS.worker}','probe',now());
      reset role;
      select set_config('request.jwt.claims', '{"sub":"${USERS.freelancer}","role":"authenticated"}', true);
      set local role authenticated;
      select 'private=' || count(*) from public.reminders where owner_id='${USERS.worker}';
      rollback;
    `);
    expect(result).toContain("private=0");
  });

  it("lets an internal sender create a message and address another internal person", () => {
    const output = sqlAs(USERS.worker, `
      insert into public.studio_messages(id,sender_id,body)
      values ('88000000-0000-4000-8000-000000000001','${USERS.worker}','probe');
      with linked as (
        insert into public.studio_message_recipients(message_id,user_id)
        values ('88000000-0000-4000-8000-000000000001','${USERS.freelancer}')
        returning 1
      )
      select count(*) from linked;
    `);
    expect(output.trim().split("\n").at(-1)).toBe("1");
  });

  it("rejects an external client recipient", () => {
    const output = sqlAsExpectError(USERS.worker, `
      with message as (
        insert into public.studio_messages(sender_id,body)
        values ('${USERS.worker}','probe') returning id
      )
      insert into public.studio_message_recipients(message_id,user_id)
      select id,'${USERS.client}' from message;
    `);
    expect(output).toContain("row-level security");
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

  it("freelancer reads clients only through the reduced directory", () => {
    // CHANGED IN PHASE 2, deliberately. This previously asserted that a
    // freelancer sees SOME clients in public.clients, via
    // clients_freelancer_select_via_tasks. That policy returned the whole row
    // — including `notes`, the agency's internal commentary about the client
    // — to anyone holding one assigned task.
    //
    // RLS cannot withhold a single column, so the row itself had to go. The
    // policy is dropped and the freelancer reads public.client_directory,
    // which has no notes, no fiscal number and no address. See
    // docs/audit/PERMISSION-MATRIX.md §4.
    const table = Number(sqlAs(USERS.freelancer, "select count(*) from public.clients;"));
    expect(table).toBe(0);

    const directory = Number(
      sqlAs(USERS.freelancer, "select count(*) from public.client_directory;"),
    );
    const total = Number(sql("select count(*) from public.clients;"));
    expect(directory).toBeGreaterThan(0);
    expect(directory).toBeLessThan(total);
  });

  it("no non-admin role can escalate its own profile to admin", () => {
    // REWRITTEN IN PHASE 2. This test could not fail.
    //
    // It performed the escalation, then re-read the role "in a fresh
    // transaction" and asserted it was unchanged. But sqlAs ALWAYS rolls back
    // — that is what makes the suite safe to run — so the re-read was
    // guaranteed to show the original value whether the UPDATE was denied or
    // succeeded. It reported a closed door for a policy that was wide open:
    // profiles_update_self permits a user to write any column of their own
    // row, `role` included.
    //
    // The measurement has to happen INSIDE the transaction that attempts it.
    // Rows affected is the only honest signal.
    for (const who of [USERS.worker, USERS.freelancer, USERS.intern, USERS.commercial, USERS.client]) {
      let affected;
      try {
        affected = sqlAs(
          who,
          `with u as (update public.profiles set role = 'admin' where id = '${who}' returning 1)
           select count(*) from u;`,
        );
      } catch {
        affected = "0"; // rejected outright — also zero rows changed
      }
      expect(`${who}:${affected}`).toBe(`${who}:0`);
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
