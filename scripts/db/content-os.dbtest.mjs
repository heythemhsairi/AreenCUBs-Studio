import { describe, it, expect, beforeAll } from "vitest";
import { sql, sqlAs, sqlAsAnon, dbAvailable, USERS } from "./sql.mjs";

/**
 * Content OS integration coverage — audit finding #1.
 *
 * All writes run inside transactions that are rolled back, so the seeded
 * fixture is never mutated. Data is fabricated throughout.
 */

beforeAll(() => {
  if (!dbAvailable()) {
    throw new Error("No local staging database. Run: npm run db:start && npm run db:reset");
  }
});

const CLIENT = "c1000000-0000-4000-8000-000000000001"; // fabricated: Atlas Foods

describe("admin can create and read a content plan", () => {
  it("creates a plan and reads it back", () => {
    // Read the CTE directly. A data-modifying CTE is not visible to other
    // reads in the same statement — PostgreSQL snapshot semantics — so joining
    // back against the table would return 0 and prove nothing.
    const out = sqlAs(
      USERS.admin,
      `with ins as (
         insert into public.monthly_content_plans (client_id, month, year, theme, status, created_by)
         values ('${CLIENT}', 11, 2027, 'Synthetic probe plan', 'draft', '${USERS.admin}')
         returning id, status
       )
       select status from ins;`,
    );
    expect(out).toBe("draft");
  });

  it("rejects an impossible month", () => {
    // CHECK (month BETWEEN 1 AND 12)
    let threw = false;
    try {
      sqlAs(
        USERS.admin,
        `insert into public.monthly_content_plans (client_id, month, year, created_by)
         values ('${CLIENT}', 13, 2027, '${USERS.admin}');`,
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("refuses a duplicate plan for the same client and month", () => {
    let threw = false;
    try {
      sqlAs(
        USERS.admin,
        `insert into public.monthly_content_plans (client_id, month, year, created_by)
         values ('${CLIENT}', 8, 2026, '${USERS.admin}');`, // already seeded
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("leaves the seeded fixture unchanged (every probe rolls back)", () => {
    expect(sql("select count(*) from public.monthly_content_plans;")).toBe("2");
  });
});

describe("content items persist correctly", () => {
  it("stores an item against a plan and returns it", () => {
    const out = sqlAs(
      USERS.admin,
      `with p as (select id from public.monthly_content_plans where client_id='${CLIENT}' limit 1),
            ins as (
              insert into public.content_items (plan_id, client_id, title, content_type, platform, status, created_by)
              select p.id, '${CLIENT}', 'Synthetic probe item', 'reel', 'instagram', 'idea', '${USERS.admin}'
              from p returning id, status, priority
            )
       select status || '/' || priority from ins;`,
    );
    expect(out).toBe("idea/normal"); // defaults applied
  });

  it("enforces the content_type vocabulary", () => {
    let threw = false;
    try {
      sqlAs(
        USERS.admin,
        `with p as (select id from public.monthly_content_plans limit 1)
         insert into public.content_items (plan_id, client_id, title, content_type, created_by)
         select p.id, '${CLIENT}', 'bad type', 'hologram', '${USERS.admin}' from p;`,
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("enforces the platform vocabulary", () => {
    let threw = false;
    try {
      sqlAs(
        USERS.admin,
        `with p as (select id from public.monthly_content_plans limit 1)
         insert into public.content_items (plan_id, client_id, title, platform, created_by)
         select p.id, '${CLIENT}', 'bad platform', 'myspace', '${USERS.admin}' from p;`,
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("requires a plan — an orphan item cannot exist", () => {
    // plan_id is NOT NULL, which is why standalone publishing posts live in
    // social_posts instead. That split is the cause of finding #16.
    const nullable = sql(
      `select is_nullable from information_schema.columns
       where table_name='content_items' and column_name='plan_id';`,
    );
    expect(nullable).toBe("NO");
  });
});

describe("CONFIRMED FINDING — Content OS RLS grants full CRUD to any authenticated identity", () => {
  /**
   * Migration 21 guards all three Content OS tables with
   *   USING (auth.role() = 'authenticated')
   * for SELECT *and* FOR ALL, while every other table in the schema uses
   * is_admin() / is_worker_or_admin() / a profiles lookup.
   *
   * Consequence: an authenticated identity with NO profiles row — which the
   * Phase 1d application fix denies at the front door — retains complete
   * read and write access to every client's content through PostgREST,
   * bypassing the UI entirely.
   *
   * These tests assert the CURRENT behaviour deliberately, so the finding is
   * locked in and any change to it is a conscious decision. The recommended
   * fix is in docs/audit/DECISIONS-NEEDED.md and is NOT applied here:
   * tightening RLS is a permission change and needs approval.
   */
  it("an unprovisioned user has no application role", () => {
    expect(sqlAs(USERS.orphan, "select coalesce(public.current_role()::text,'NULL');")).toBe("NULL");
    expect(sqlAs(USERS.orphan, "select public.is_worker_or_admin();")).toBe("f");
  });

  it("yet READS every client's plans, items and profiles", () => {
    expect(Number(sqlAs(USERS.orphan, "select count(*) from public.monthly_content_plans;"))).toBeGreaterThan(0);
    expect(Number(sqlAs(USERS.orphan, "select count(*) from public.content_items;"))).toBeGreaterThan(0);
    expect(Number(sqlAs(USERS.orphan, "select count(*) from public.client_content_profiles;"))).toBeGreaterThan(0);
  });

  it("and can INSERT a plan for a client it has no relationship to", () => {
    const inserted = sqlAs(
      USERS.orphan,
      `with i as (
         insert into public.monthly_content_plans (client_id, month, year, theme)
         values ('${CLIENT}', 9, 2027, 'synthetic probe') returning 1)
       select count(*) from i;`,
    );
    expect(inserted).toBe("1"); // documents the gap
  });

  it("and can UPDATE and DELETE every content item", () => {
    const updated = sqlAs(
      USERS.orphan,
      "with u as (update public.content_items set title='synthetic probe' returning 1) select count(*) from u;",
    );
    const deleted = sqlAs(
      USERS.orphan,
      "with d as (delete from public.content_items returning 1) select count(*) from d;",
    );
    expect(Number(updated)).toBeGreaterThan(0);
    expect(Number(deleted)).toBeGreaterThan(0);
  });

  it("the policy expression is the cause", () => {
    const quals = sql(
      `select string_agg(distinct qual, ' | ') from pg_policies
       where tablename in ('client_content_profiles','monthly_content_plans','content_items');`,
    );
    expect(quals).toContain("auth.role()");
    expect(quals).not.toContain("is_admin");
    expect(quals).not.toContain("is_worker_or_admin");
  });

  it("by contrast, admin_tasks and expenses check the profile role", () => {
    const quals = sql(
      `select string_agg(distinct qual, ' | ') from pg_policies
       where tablename in ('admin_tasks','expenses');`,
    );
    expect(quals).toMatch(/is_admin|profiles/);
  });

  it("a truly anonymous caller IS correctly denied", () => {
    // The boundary is "any authenticated identity", not "anyone" — which is
    // why this was invisible to the unauthenticated probes in Phase 0.
    expect(sqlAsAnon("select count(*) from public.content_items;")).toBe("0");
    expect(sqlAsAnon("select count(*) from public.monthly_content_plans;")).toBe("0");
  });

  it("leaves the fixture unchanged — every probe rolled back", () => {
    expect(sql("select count(*) from public.content_items;")).toBe("3");
    expect(sql("select count(*) from public.monthly_content_plans;")).toBe("2");
  });
});

describe("reports and totals use the expected source tables — finding #16", () => {
  it("publishing posts live in social_posts, NOT content_items", () => {
    // The reports page draws totals from social_posts but breakdowns from
    // content_items. Two different models, which is why a total of 21 posts
    // could show no platform breakdown.
    const posts = Number(sql("select count(*) from public.social_posts;"));
    const items = Number(sql("select count(*) from public.content_items;"));
    expect(posts).toBeGreaterThan(0);
    expect(items).toBeGreaterThan(0);
    expect(posts).not.toBe(items);
  });

  it("social_posts carries platforms as an array while content_items carries one platform", () => {
    const postsType = sql(
      `select data_type from information_schema.columns
       where table_name='social_posts' and column_name='platforms';`,
    );
    const itemsType = sql(
      `select data_type from information_schema.columns
       where table_name='content_items' and column_name='platform';`,
    );
    expect(postsType).toBe("ARRAY");
    expect(itemsType).toBe("text");
  });

  it("the two models cannot be summed without double counting or gaps", () => {
    // Recorded as evidence for finding #16: there is no join key between a
    // social_posts row and a content_items row, so a combined total is not
    // derivable from the schema as it stands.
    const fk = Number(
      sql(`select count(*) from information_schema.table_constraints tc
           join information_schema.constraint_column_usage ccu
             on tc.constraint_name = ccu.constraint_name
           where tc.table_name='social_posts' and ccu.table_name='content_items';`),
    );
    expect(fk).toBe(0);
  });
});

describe("overdue scheduled posts — finding #3", () => {
  it("past-dated posts are still marked scheduled", () => {
    const n = Number(
      sql(`select count(*) from public.social_posts
           where status='scheduled' and scheduled_at < now();`),
    );
    expect(n).toBeGreaterThan(0);
  });

  it("the status enum has no overdue/failed/processing member", () => {
    // Confirms the gap: 'overdue' must be derived at read time, and there is
    // nowhere to record a failure reason.
    const labels = sql(
      `select string_agg(e.enumlabel, ',' order by e.enumsortorder)
       from pg_enum e join pg_type t on t.oid = e.enumtypid
       where t.typname = 'social_post_status';`,
    );
    expect(labels).toBe("draft,scheduled,published,cancelled");
    for (const missing of ["overdue", "failed", "processing"]) {
      expect(labels).not.toContain(missing);
    }
  });

  it("there is no scheduler — publishing is manual tracking only", () => {
    const jobs = Number(
      sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname ilike '%publish%';`),
    );
    expect(jobs).toBe(0);
  });
});
