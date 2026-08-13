#!/usr/bin/env node
/**
 * Staging verification.
 *
 * Answers, against the LOCAL stack only, the questions Phase 0 could not:
 *
 *   1. Does every migration apply cleanly to an empty database?
 *   2. Does the Content OS schema exist and is it reachable? (audit finding #1)
 *   3. Is migration 21 re-runnable, or does its unguarded CREATE POLICY block
 *      abort a retry and leave the schema half-built?
 *   4. Are the finance contradictions from finding #5 present in seeded data?
 *
 * Talks to Postgres through `docker exec` on the local supabase_db container
 * rather than through the Supabase CLI: it needs no extra subcommand support
 * and cannot be pointed at a remote project by accident.
 *
 * Read-only. The single write attempt (the idempotency probe) runs inside a
 * transaction that is always rolled back.
 *
 * Usage:  npm run db:start && npm run db:reset && npm run db:verify
 */

import { execFileSync } from "node:child_process";

// ── Docker / container resolution ────────────────────────────────────────────

function resolveDocker() {
  const candidates = ["docker"];
  if (process.platform === "win32") {
    candidates.push(
      `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Docker\\Docker\\resources\\bin\\docker.exe`,
    );
  } else {
    candidates.push("/usr/local/bin/docker", "/usr/bin/docker");
  }
  for (const c of candidates) {
    try {
      execFileSync(c, ["--version"], { stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 });
      return c;
    } catch {
      /* next */
    }
  }
  return null;
}

const docker = resolveDocker();
if (!docker) {
  console.error("Docker not found. Run `npm run db:preflight`.");
  process.exit(1);
}

function findDbContainer() {
  const names = execFileSync(docker, ["ps", "--format", "{{.Names}}"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const db = names.find((n) => n.startsWith("supabase_db_"));
  if (!db) {
    console.error("No running supabase_db container. Run `npm run db:start`.");
    process.exit(1);
  }
  // Guard: the container name is derived from the LOCAL stack. There is no
  // path from here to a hosted project, but assert the shape anyway.
  if (/supabase\.(co|in)/i.test(db)) {
    console.error("REFUSED: container name looks remote.");
    process.exit(1);
  }
  return db;
}

const container = findDbContainer();

/** Runs a query and returns trimmed, tuple-only output. */
function sql(query) {
  return execFileSync(
    docker,
    ["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-tAc", query],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
  ).trim();
}

/** Runs a statement expected to fail; returns its SQLSTATE, or null on success. */
function sqlstateOf(statement) {
  try {
    execFileSync(
      docker,
      [
        "exec",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `begin; ${statement}; rollback;`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
    );
    return null;
  } catch (err) {
    const text = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    const m = /SQLSTATE[^0-9A-Z]*([0-9A-Z]{5})/i.exec(text) ?? /ERROR:\s*(.+)/i.exec(text);
    return m ? m[1] : text.split("\n")[0];
  }
}

// ── Harness ──────────────────────────────────────────────────────────────────

let failures = 0;
let checks = 0;

function check(label, fn) {
  checks++;
  try {
    const detail = fn();
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${label}`);
    console.log(`        ${String(err.message).split("\n")[0]}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("\nAreen CUBs Studio - staging verification");
console.log(`Container: ${container} (local only)\n`);

// ── 1. Connectivity ──────────────────────────────────────────────────────────
console.log("Connectivity");
check("local database reachable", () => {
  expect(sql("select 1;") === "1", "unexpected response");
  return "ok";
});

check("server is not a hosted Supabase instance", () => {
  const host = sql("select inet_server_addr();");
  // Loopback or a private container address only.
  expect(!/supabase\.(co|in)/i.test(host), `unexpected host ${host}`);
  return host || "unix socket";
});

// ── 2. Migrations ────────────────────────────────────────────────────────────
console.log("\nMigration history");
check("all repository migrations are recorded as applied", () => {
  const n = Number(sql("select count(*) from supabase_migrations.schema_migrations;"));
  expect(n >= 25, `only ${n} migrations recorded`);
  return `${n} applied`;
});

// ── 3. Content OS schema — audit finding #1 ──────────────────────────────────
console.log("\nContent OS schema (finding #1)");
for (const table of ["client_content_profiles", "monthly_content_plans", "content_items"]) {
  check(`public.${table} exists`, () => {
    expect(sql(`select to_regclass('public.${table}') is not null;`) === "t", "table absent");
    return "present";
  });
}

check("content_items.plan_id references monthly_content_plans", () => {
  const n = Number(
    sql(`select count(*) from information_schema.table_constraints tc
         join information_schema.constraint_column_usage ccu
           on tc.constraint_name = ccu.constraint_name
         where tc.table_name = 'content_items'
           and tc.constraint_type = 'FOREIGN KEY'
           and ccu.table_name = 'monthly_content_plans';`),
  );
  expect(n >= 1, "relationship missing");
  return "relationship intact";
});

check("RLS enabled on all three Content OS tables", () => {
  const n = Number(
    sql(`select count(*) from pg_tables where schemaname='public'
         and tablename in ('client_content_profiles','monthly_content_plans','content_items')
         and rowsecurity = true;`),
  );
  expect(n === 3, `only ${n}/3 have RLS enabled`);
  return "3/3";
});

check("Content OS tables are exposed to PostgREST", () => {
  // PostgREST serves what it can see in the `public` schema. If the table is
  // present here but the API 404s, the schema cache is stale rather than the
  // schema being absent — the distinction finding #1 turns on.
  const n = Number(
    sql(`select count(*) from information_schema.tables where table_schema='public'
         and table_name in ('client_content_profiles','monthly_content_plans','content_items');`),
  );
  expect(n === 3, `only ${n}/3 visible`);
  return "3/3 visible in information_schema";
});

check("seeded Content OS rows are readable", () => {
  const plans = Number(sql("select count(*) from public.monthly_content_plans;"));
  const items = Number(sql("select count(*) from public.content_items;"));
  expect(plans > 0 && items > 0, `plans=${plans} items=${items}`);
  return `${plans} plans, ${items} items`;
});

// ── 4. Migration 21 idempotency — empirical ──────────────────────────────────
console.log("\nMigration 21 idempotency (finding #1 root cause)");
check("re-running migration 21's CREATE POLICY fails (hazard is real)", () => {
  const state = sqlstateOf(
    `create policy "content_profiles_read" on public.client_content_profiles for select using (true)`,
  );
  // 42710 = duplicate_object. Proves a partial apply cannot self-heal on retry.
  expect(state !== null, "unexpectedly succeeded — policy was absent?");
  return `rejected with ${state} — a retry aborts, repair migration still required`;
});

// ── 5. Finance contradictions — audit finding #5 ─────────────────────────────
console.log("\nFinance contradictions (finding #5)");
check("invoice marked paid while a balance remains", () => {
  const n = Number(
    sql(`select count(*) from public.devis d where d.kind='facture' and d.payment_status='paid'
         and d.total_dt - coalesce((select sum(p.amount_dt) from public.payments p
                                    where p.devis_id = d.id),0) > 0.01;`),
  );
  expect(n >= 1, "fixture not present — run npm run db:reset");
  return `${n} reproduced`;
});

check("the shortfall is exactly the 1 DT fiscal stamp", () => {
  const gap = sql(`select round(d.total_dt - coalesce((select sum(p.amount_dt)
                     from public.payments p where p.devis_id = d.id),0), 2)
                   from public.devis d where d.kind='facture' and d.payment_status='paid'
                   and d.total_dt - coalesce((select sum(p.amount_dt) from public.payments p
                                              where p.devis_id = d.id),0) > 0.01 limit 1;`);
  expect(Number(gap) === 1, `gap is ${gap}, expected 1.00`);
  return `${gap} DT outstanding on a 'paid' invoice`;
});

check("a quote carries a payment_status it should not have", () => {
  const n = Number(
    sql("select count(*) from public.devis where kind='devis' and payment_status is not null;"),
  );
  expect(n >= 1, "fixture not present");
  return `${n} quote(s)`;
});

check("no database constraint prevents the impossible states", () => {
  // Documents the gap Phase 1 must close: nothing stops kind='devis' carrying
  // a payment_status, or a draft being marked paid.
  const n = Number(
    sql(`select count(*) from pg_constraint c join pg_class t on t.oid=c.conrelid
         where t.relname='devis' and c.contype='c'
         and pg_get_constraintdef(c.oid) ilike '%payment_status%';`),
  );
  expect(n === 0, `unexpected: ${n} constraint(s) already exist`);
  return "confirmed absent — constraints are Phase 1 work";
});

// ── 6. Fail-closed auth fixture — Phase 1d ───────────────────────────────────
console.log("\nAuth fail-closed fixture (Phase 1d)");
check("an auth user exists with no matching profile", () => {
  const n = Number(
    sql(`select count(*) from auth.users u left join public.profiles p on p.id = u.id
         where u.email = 'orphan@staging.local' and p.id is null;`),
  );
  expect(n === 1, "orphan fixture missing");
  return "present — signing in as this user must be denied";
});

check("the three role fixtures exist", () => {
  const roles = sql(
    "select string_agg(role::text, ',' order by role::text) from public.profiles;",
  );
  expect(roles.includes("admin") && roles.includes("worker") && roles.includes("freelancer"), roles);
  return roles;
});

// ── Result ───────────────────────────────────────────────────────────────────
console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures > 0) {
  console.log("\nOne or more checks failed. If the Content OS checks failed, the");
  console.log("migrations did not apply cleanly — capture the output before changing anything.\n");
  process.exit(1);
}
console.log("Staging environment verified.\n");
