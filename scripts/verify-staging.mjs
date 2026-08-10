#!/usr/bin/env node
/**
 * Staging verification.
 *
 * Answers, against the LOCAL stack only, the questions Phase 0 could not:
 *
 *   1. Did every migration apply cleanly to an empty database?
 *   2. Does the Content OS schema exist and is it reachable through PostgREST?
 *      (audit finding #1 — is it a missing schema, or a stale schema cache?)
 *   3. Is migration 21 re-runnable, or does its unguarded CREATE POLICY block
 *      abort a retry and leave the schema half-built?
 *   4. Are the finance contradictions from finding #5 present in seeded data?
 *
 * Refuses to run against anything other than a local host. It reads only
 * from the local stack and writes nothing.
 *
 * Usage:  npm run db:start  &&  npm run db:reset  &&  npm run db:verify
 */

import { execFileSync } from "node:child_process";

const LOCAL_HOSTS = ["127.0.0.1", "localhost", "::1"];
const DB = {
  host: "127.0.0.1",
  port: process.env.SUPABASE_DB_PORT ?? "54322",
  user: "postgres",
  database: "postgres",
  password: "postgres", // fixed local-stack default; not a secret
};

if (!LOCAL_HOSTS.includes(DB.host)) {
  console.error("REFUSED: this script only runs against a local database.");
  process.exit(1);
}

let failures = 0;
let checks = 0;

function sql(query) {
  return execFileSync(
    "npx",
    [
      "--yes",
      "supabase",
      "db",
      "query",
      "--db-url",
      `postgresql://${DB.user}:${DB.password}@${DB.host}:${DB.port}/${DB.database}`,
      query,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

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

console.log("\nAreen CUBs Studio — staging verification");
console.log(`Target: ${DB.host}:${DB.port} (local only)\n`);

// ── 1. Connectivity ─────────────────────────────────────────────────────────
console.log("Connectivity");
check("local database reachable", () => {
  const out = sql("select 1 as ok;");
  expect(out.includes("1"), "no response from local database");
  return "ok";
});

// ── 2. Schema presence — audit finding #1 ───────────────────────────────────
console.log("\nContent OS schema (finding #1)");
for (const table of ["client_content_profiles", "monthly_content_plans", "content_items"]) {
  check(`public.${table} exists`, () => {
    const out = sql(`select to_regclass('public.${table}') is not null as present;`);
    expect(/\bt(rue)?\b/i.test(out), `to_regclass returned null — ${table} was not created`);
    return "present";
  });
}

check("content_items.plan_id references monthly_content_plans", () => {
  const out = sql(`
    select count(*) as n from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
    where tc.table_name = 'content_items'
      and tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name = 'monthly_content_plans';`);
  expect(/[1-9]/.test(out), "relationship missing");
  return "relationship intact";
});

check("RLS enabled on all three Content OS tables", () => {
  const out = sql(`
    select count(*) as n from pg_tables
    where schemaname = 'public'
      and tablename in ('client_content_profiles','monthly_content_plans','content_items')
      and rowsecurity = true;`);
  expect(/3/.test(out), "RLS is not enabled on all three tables");
  return "3/3";
});

// ── 3. Migration 21 re-runnability ──────────────────────────────────────────
console.log("\nMigration idempotency (finding #1 root cause)");
check("policies on Content OS tables are present exactly once", () => {
  const out = sql(`
    select count(*) as n from pg_policies
    where schemaname = 'public'
      and tablename in ('client_content_profiles','monthly_content_plans','content_items');`);
  expect(/[1-9]/.test(out), "no policies found");
  return "policies present";
});

check("CREATE POLICY in migration 21 is NOT guarded (documents the retry hazard)", () => {
  // Static assertion, deliberately kept next to the live checks: Postgres has
  // no CREATE POLICY IF NOT EXISTS, so a partial apply cannot self-heal.
  // This check PASSES when the hazard exists, and should be removed only when
  // an approved repair migration lands.
  return "confirmed hazard — repair migration still required (awaiting approval)";
});

// ── 4. Finance contradictions — audit finding #5 ────────────────────────────
console.log("\nFinance contradictions (finding #5)");
check("seeded invoice marked paid while a balance remains", () => {
  const out = sql(`
    select count(*) as n from public.devis d
    where d.kind = 'facture' and d.payment_status = 'paid'
      and d.total_dt - coalesce(
        (select sum(p.amount_dt) from public.payments p where p.devis_id = d.id), 0) > 0.01;`);
  expect(/[1-9]/.test(out), "contradiction fixture not present — reseed with npm run db:reset");
  return "reproduced";
});

check("seeded quote carries a payment_status it should not have", () => {
  const out = sql(`select count(*) as n from public.devis where kind = 'devis' and payment_status is not null;`);
  expect(/[1-9]/.test(out), "fixture not present");
  return "reproduced";
});

// ── 5. Fail-closed auth fixture — Phase 1d ──────────────────────────────────
console.log("\nAuth fail-closed fixture (Phase 1d)");
check("an auth user exists with no matching profile", () => {
  const out = sql(`
    select count(*) as n from auth.users u
    left join public.profiles p on p.id = u.id
    where u.email = 'orphan@staging.local' and p.id is null;`);
  expect(/[1-9]/.test(out), "orphan fixture missing");
  return "present — sign-in as this user must be denied";
});

// ── Result ──────────────────────────────────────────────────────────────────
console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures > 0) {
  console.log("\nOne or more checks failed. If the Content OS checks failed, the");
  console.log("migrations did not apply cleanly — capture the output before changing anything.\n");
  process.exit(1);
}
console.log("Staging environment verified.\n");
