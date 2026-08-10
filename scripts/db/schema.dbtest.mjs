import { describe, it, expect, beforeAll } from "vitest";
import { sql, sqlExpectError, dbAvailable } from "./sql.mjs";

/**
 * Schema integration tests for migrations 0018-0025.
 *
 * These are the migrations that a hard syntax error in 0018 prevented from
 * ever applying (see PHASE-0-DISCOVERY.md §3.1.1). They assert that the whole
 * tail of the chain lands correctly on a fresh database.
 *
 * IMPORTANT: passing here proves the migrations are correct for a FRESH
 * install. It says nothing about production, where 0018 is already recorded
 * as failed and will not re-run. Repair must be forward-only.
 */

beforeAll(() => {
  if (!dbAvailable()) {
    throw new Error("No local staging database. Run: npm run db:start && npm run db:reset");
  }
});

const has = (kind, name) => {
  switch (kind) {
    case "table":
      return sql(`select to_regclass('public.${name}') is not null;`) === "t";
    case "function":
      return (
        sql(
          `select count(*) > 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='public' and p.proname='${name}';`,
        ) === "t"
      );
    case "trigger":
      return sql(`select count(*) > 0 from pg_trigger where tgname='${name}';`) === "t";
    case "policy":
      return sql(`select count(*) > 0 from pg_policies where policyname='${name}';`) === "t";
    case "index":
      return sql(`select count(*) > 0 from pg_indexes where indexname='${name}';`) === "t";
    default:
      throw new Error(`unknown kind ${kind}`);
  }
};

describe("migration history", () => {
  it("records all 25 repository migrations as applied", () => {
    const n = Number(sql("select count(*) from supabase_migrations.schema_migrations;"));
    expect(n).toBeGreaterThanOrEqual(25);
  });

  it("includes the tail that production could never reach", () => {
    const versions = sql(
      "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations;",
    );
    for (const v of [
      "20260624000018",
      "20260624000019",
      "20260624000020",
      "20260625000021",
      "20260625000022",
      "20260626000001",
      "20260626000002",
      "20260626000003",
    ]) {
      expect(versions).toContain(v);
    }
  });
});

describe("0018 operational_improvements", () => {
  it.each(["app_updates", "app_update_items", "user_update_views"])("table %s exists", (t) => {
    expect(has("table", t)).toBe(true);
  });

  it.each([
    "updates_read",
    "updates_admin_write",
    "update_items_read",
    "update_items_admin_write",
    "views_own",
  ])("policy %s exists", (p) => {
    expect(has("policy", p)).toBe(true);
  });

  it("has RLS enabled on all three tables", () => {
    const n = Number(
      sql(`select count(*) from pg_tables where schemaname='public'
           and tablename in ('app_updates','app_update_items','user_update_views')
           and rowsecurity;`),
    );
    expect(n).toBe(3);
  });

  it("the admin-write policy references the SCHEMA-QUALIFIED current_role()", () => {
    // The bug that blocked the entire tail of the chain: bare `current_role()`
    // collides with the reserved PostgreSQL keyword and is a syntax error.
    const def = sql(
      `select pg_get_expr(polqual, polrelid) from pg_policy
       where polname = 'updates_admin_write';`,
    );
    expect(def).toContain("current_role");
    expect(def).not.toMatch(/(?<!\.)\bcurrent_role\(\)/);
  });
});

describe("0019 finance_os_v2", () => {
  it("creates the expenses table with its trigger and policies", () => {
    expect(has("table", "expenses")).toBe(true);
    expect(has("trigger", "trg_expenses_updated")).toBe(true);
    expect(has("policy", "admin_all_expenses")).toBe(true);
    expect(has("policy", "worker_read_expenses")).toBe(true);
  });

  it.each(["expenses_date_idx", "expenses_category_idx", "expenses_project_idx", "expenses_client_idx"])(
    "index %s exists",
    (i) => {
      expect(has("index", i)).toBe(true);
    },
  );
});

describe("0021 content_os", () => {
  it.each(["client_content_profiles", "monthly_content_plans", "content_items"])(
    "table %s exists",
    (t) => {
      expect(has("table", t)).toBe(true);
    },
  );

  it.each([
    "trg_content_profiles_updated_at",
    "trg_content_plans_updated_at",
    "trg_content_items_updated_at",
  ])("trigger %s exists", (t) => {
    expect(has("trigger", t)).toBe(true);
  });

  it("defines set_updated_at", () => {
    expect(has("function", "set_updated_at")).toBe(true);
  });

  it("enforces one content profile per client", () => {
    const n = Number(
      sql(`select count(*) from pg_constraint c join pg_class t on t.oid=c.conrelid
           where t.relname='client_content_profiles' and c.contype='u';`),
    );
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it("enforces one plan per client per month", () => {
    const def = sql(
      `select pg_get_constraintdef(c.oid) from pg_constraint c
       join pg_class t on t.oid=c.conrelid
       where t.relname='monthly_content_plans' and c.contype='u' limit 1;`,
    );
    expect(def).toMatch(/client_id/);
    expect(def).toMatch(/month/);
    expect(def).toMatch(/year/);
  });

  it("cascades content items when a plan is deleted", () => {
    const rule = sql(
      `select confdeltype from pg_constraint c
       join pg_class t on t.oid=c.conrelid
       join pg_class f on f.oid=c.confrelid
       where t.relname='content_items' and f.relname='monthly_content_plans' limit 1;`,
    );
    expect(rule).toBe("c"); // ON DELETE CASCADE
  });
});

describe("0022 admin_tasks", () => {
  it("creates the table with an updated_at trigger", () => {
    expect(has("table", "admin_tasks")).toBe(true);
    expect(has("trigger", "admin_tasks_updated_at")).toBe(true);
  });

  it("is admin-only by policy", () => {
    const policies = sql(
      `select string_agg(policyname, ',') from pg_policies where tablename='admin_tasks';`,
    );
    expect(policies.toLowerCase()).toContain("admin");
  });
});

describe("0024 devis_stamp / 0025 fix_devis_totals", () => {
  it("adds stamp_dt to devis with a non-negative default", () => {
    const col = sql(
      `select column_default from information_schema.columns
       where table_name='devis' and column_name='stamp_dt';`,
    );
    expect(col).toContain("0");
  });

  it("leaves total_dt consistent with its own components after the heal", () => {
    const inconsistent = Number(
      sql(`select count(*) from public.devis
           where total_dt is distinct from round(
             coalesce(subtotal_dt,0) - coalesce(discount_dt,0)
             + coalesce(tva_dt,0) + coalesce(stamp_dt,0), 2);`),
    );
    expect(inconsistent).toBe(0);
  });
});

describe("migration 21 retry hazard (finding #1 root cause)", () => {
  it("cannot be re-run — an unguarded CREATE POLICY aborts a retry", () => {
    // Documented empirically rather than inferred. A partial apply of
    // migration 21 can therefore never self-heal, which is why a separate
    // guarded repair migration is still required (and still unapproved).
    const err = sqlExpectError(
      `create policy "content_profiles_read" on public.client_content_profiles for select using (true);`,
    );
    expect(err.toLowerCase()).toMatch(/already exists/);
  });

  it("the same hazard exists for every policy migration 21 creates", () => {
    for (const [policy, table] of [
      ["content_plans_read", "monthly_content_plans"],
      ["content_items_read", "content_items"],
    ]) {
      const err = sqlExpectError(
        `create policy "${policy}" on public.${table} for select using (true);`,
      );
      expect(err.toLowerCase()).toMatch(/already exists/);
    }
  });
});
