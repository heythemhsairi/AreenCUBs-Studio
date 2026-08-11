/**
 * Test helper: talks to the LOCAL staging PostgreSQL through `docker exec`.
 *
 * Deliberately not the Supabase JS client:
 *   - no keys are needed, so none can leak into a fixture or a log
 *   - it cannot be pointed at a hosted project by a stray environment variable
 *   - RLS can be exercised by impersonating a role inside a transaction
 *
 * Refuses to run against anything that does not look like the local stack.
 */

import { execFileSync } from "node:child_process";

function resolveDocker() {
  const candidates =
    process.platform === "win32"
      ? ["docker", `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Docker\\Docker\\resources\\bin\\docker.exe`]
      : ["docker", "/usr/bin/docker", "/usr/local/bin/docker"];
  for (const c of candidates) {
    try {
      execFileSync(c, ["--version"], { stdio: ["ignore", "pipe", "pipe"], timeout: 20_000 });
      return c;
    } catch {
      /* next */
    }
  }
  return null;
}

const docker = resolveDocker();

let cachedContainer;
export function dbContainer() {
  if (cachedContainer !== undefined) return cachedContainer;
  if (!docker) return (cachedContainer = null);
  try {
    const names = execFileSync(docker, ["ps", "--format", "{{.Names}}"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20_000,
    })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const db = names.find((n) => n.startsWith("supabase_db_")) ?? null;
    if (db && /supabase\.(co|in)/i.test(db)) {
      throw new Error("REFUSED: container name looks remote");
    }
    return (cachedContainer = db);
  } catch {
    return (cachedContainer = null);
  }
}

/** True when a local staging database is available to test against. */
export function dbAvailable() {
  return dbContainer() !== null;
}

/** Runs SQL, returns trimmed tuple-only output. Throws on SQL error. */
export function sql(query) {
  const c = dbContainer();
  if (!c) throw new Error("no local staging database");
  return execFileSync(
    docker,
    ["exec", c, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", query],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
  ).trim();
}

/**
 * Runs SQL expecting failure; returns the error text. Throws if it succeeds.
 *
 * ALWAYS wrapped in a rolled-back transaction. This previously ran bare, and
 * when a probe that was *expected* to fail instead succeeded, its effect
 * persisted: a `CREATE POLICY ... USING (true)` probe left a permissive policy
 * behind and silently re-opened a table for every later test in the run. A
 * diagnostic must never be able to change the database it is inspecting.
 */
export function sqlExpectError(query) {
  const c = dbContainer();
  if (!c) throw new Error("no local staging database");
  const wrapped = `begin; ${query}; rollback;`;
  try {
    execFileSync(
      docker,
      ["exec", c, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", wrapped],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
    );
  } catch (err) {
    return `${err.stdout ?? ""}${err.stderr ?? ""}`.trim() || err.message;
  }
  throw new Error("expected the statement to fail, but it succeeded");
}

/**
 * Runs SQL as an impersonated application user, inside a transaction that is
 * ALWAYS rolled back.
 *
 * `set local role authenticated` drops the superuser privileges that would
 * otherwise bypass RLS entirely — without it these tests would prove nothing.
 * `request.jwt.claims` is what Supabase's auth.uid() reads.
 *
 * Passing userId = null impersonates an anonymous caller.
 */
export function sqlAs(userId, query) {
  const claims =
    userId === null
      ? `'{"role":"authenticated"}'`
      : `'{"sub":"${userId}","role":"authenticated"}'`;

  // psql echoes a command tag for every statement (SET, ROLLBACK, INSERT 0 1),
  // so the caller's result cannot be located by position. Fencing it between
  // sentinel rows makes extraction exact regardless of how many tags appear.
  const wrapped = [
    "begin;",
    `select set_config('request.jwt.claims', ${claims}, true);`,
    "set local role authenticated;",
    `select '${MARK_START}';`,
    query,
    `select '${MARK_END}';`,
    "rollback;",
  ].join(" ");

  const c = dbContainer();
  const out = execFileSync(
    docker,
    ["exec", c, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", wrapped],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
  );
  return extractFenced(out);
}

const MARK_START = "__AC_R_START__";
const MARK_END = "__AC_R_END__";

/** Pulls the rows between the sentinels, dropping psql's command tags. */
function extractFenced(output) {
  const lines = output.split("\n").map((l) => l.trim());
  const i = lines.indexOf(MARK_START);
  const j = lines.indexOf(MARK_END);
  if (i === -1 || j === -1 || j < i) {
    // No fence found: the statement failed before reaching it.
    return output.trim();
  }
  return lines
    .slice(i + 1, j)
    .filter((l) => l !== "" && l !== "SET" && l !== "BEGIN" && l !== "ROLLBACK")
    .join("\n");
}

/**
 * Runs SQL as a genuinely anonymous caller: the `anon` role with NO jwt
 * claims. Distinct from sqlAs(null, …), which still presents
 * role=authenticated and therefore satisfies `auth.role() = 'authenticated'`.
 * The difference matters — it is exactly the boundary the Content OS policies
 * key on.
 */
export function sqlAsAnon(query) {
  const c = dbContainer();
  if (!c) throw new Error("no local staging database");
  const wrapped = [
    "begin;",
    "set local role anon;",
    `select '${MARK_START}';`,
    query,
    `select '${MARK_END}';`,
    "rollback;",
  ].join(" ");
  const out = execFileSync(
    docker,
    ["exec", c, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", wrapped],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
  );
  return extractFenced(out);
}

/**
 * Runs a write as an impersonated user and returns the number of rows
 * AFFECTED, treating an outright rejection as zero.
 *
 * RLS denies a write by filtering rows, not by raising, so a denied UPDATE
 * returns success with zero rows. Asserting "did it throw?" would pass
 * vacuously; this returns the number that actually matters. An INSERT blocked
 * by a WITH CHECK clause DOES raise, so both shapes are normalised to 0.
 */
export function sqlAsExpectDeniedOrZero(userId, query) {
  try {
    const out = sqlAs(userId, query);
    const n = Number(String(out).trim().split("\n").pop());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0; // rejected outright — also zero rows affected
  }
}

/** As sqlAs, but expects the statement to be rejected. Returns the error. */
export function sqlAsExpectError(userId, query) {
  try {
    sqlAs(userId, query);
  } catch (err) {
    return `${err.stdout ?? ""}${err.stderr ?? ""}`.trim() || err.message;
  }
  throw new Error("expected the statement to be denied, but it succeeded");
}

/** Seeded synthetic accounts. Fabricated; see supabase/seed.sql. */
export const USERS = {
  admin: "11111111-1111-4111-8111-111111111111",
  worker: "22222222-2222-4222-8222-222222222222",
  freelancer: "33333333-3333-4333-8333-333333333333",
  /** Authenticated but deliberately has NO profiles row. */
  orphan: "44444444-4444-4444-8444-444444444444",
  commercial: "55555555-5555-4555-8555-555555555555",
  intern: "66666666-6666-4666-8666-666666666666",
  /** A contact at a client organisation — not an employee. */
  client: "77777777-7777-4777-8777-777777777777",
};

/** Fabricated fixture ids the role matrix is measured against. */
export const FIXTURES = {
  /** Atlas Foods — the portal contact's organisation. Worker-linked. */
  clientAtlas: "c1000000-0000-4000-8000-000000000001",
  /** Nova Immobilier — assigned to the commercial. Worker-linked. */
  clientNova: "c1000000-0000-4000-8000-000000000002",
  /** Zenith Fitness — the intern's only client. Worker-linked. */
  clientZenith: "c1000000-0000-4000-8000-000000000003",
  /** Meridian — commercial-authored, no project: outside worker scope. */
  clientMeridian: "c1000000-0000-4000-8000-000000000004",
  projectAtlas: "e1000000-0000-4000-8000-000000000001",
  projectZenith: "e1000000-0000-4000-8000-000000000003",
  /** Assigned to the freelancer. */
  taskFreelancer: "7a000000-0000-4000-8000-000000000002",
  /** Assigned to the intern (and the worker); already done. */
  taskIntern: "7a000000-0000-4000-8000-000000000005",
  /** The intern's open task. */
  taskInternOpen: "7a000000-0000-4000-8000-000000000006",
  /** Draft quote for a commercial-owned client. */
  devisDraft: "d1000000-0000-4000-8000-000000000006",
  /** Already issued ('sent') — a commercial must not be able to touch it. */
  devisSent: "d1000000-0000-4000-8000-000000000005",
};
