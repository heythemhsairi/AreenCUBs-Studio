#!/usr/bin/env node
/**
 * Ephemeral local-credential provisioning for the browser suite.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Earlier attempts read `supabase status -o env` through shell command
 * substitution, temp display files, sed and nested WSL quoting. Every layer
 * mangled something. This helper removes all of them: it invokes the Linux
 * binary directly, with no shell, captures stdout and stderr separately, and
 * parses JSON in-process.
 *
 * ── Secrecy contract ─────────────────────────────────────────────────────────
 * Credential values are consumed in memory and written to one 0600 file. This
 * process NEVER prints a value, length, prefix, hash or fragment. Its stdout is
 * limited to status lines and the NAMES of missing fields.
 *
 * Only the anonymous/publishable key is exposed to browser code via a
 * NEXT_PUBLIC_ variable. A service-role or secret key is written only when
 * explicitly requested with --with-service-role, and never under a
 * NEXT_PUBLIC_ name.
 *
 * Usage (inside the WSL clone):
 *   node scripts/e2e-env.mjs --write [--with-service-role]
 *   node scripts/e2e-env.mjs --cleanup
 */

import { spawnSync, execFileSync } from "node:child_process";
import { writeFileSync, existsSync, rmSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(process.cwd());
const ENV_FILE = join(REPO, ".env.local");
const SUPABASE_BIN = join(REPO, "node_modules", ".bin", "supabase");

const args = process.argv.slice(2);
const WANT_SERVICE_ROLE = args.includes("--with-service-role");

// ── Cleanup mode ─────────────────────────────────────────────────────────────
if (args.includes("--cleanup")) {
  if (existsSync(ENV_FILE)) {
    rmSync(ENV_FILE, { force: true });
    console.log("[env] deleted .env.local");
  } else {
    console.log("[env] .env.local already absent");
  }
  process.exit(0);
}

// ── Guard: the target must be git-ignored BEFORE anything is written ─────────
function assertIgnored(path) {
  const r = spawnSync("git", ["check-ignore", "-q", path], { cwd: REPO, shell: false });
  // exit 0 = ignored, 1 = not ignored, other = error
  if (r.status !== 0) {
    console.error(`[env] REFUSED: ${path} is not git-ignored. Refusing to write credentials.`);
    process.exit(1);
  }
}

// ── Read the local stack status ──────────────────────────────────────────────
const ANSI = /\[[0-9;]*[A-Za-z]/g;

function firstJson(...streams) {
  for (const raw of streams) {
    if (!raw) continue;
    const text = raw.toString("utf8").replace(ANSI, "").trim();
    if (!text) continue;
    // The CLI may prepend notices; take the outermost JSON object.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* try the next stream */
    }
  }
  return null;
}

function readStatus() {
  if (!existsSync(SUPABASE_BIN)) {
    console.error(`[env] supabase binary not found at ${SUPABASE_BIN} — run npm install`);
    process.exit(1);
  }
  // execFileSync first; spawnSync as the documented fallback.
  try {
    const out = execFileSync(SUPABASE_BIN, ["status", "-o", "json"], {
      cwd: REPO,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const parsed = firstJson(out);
    if (parsed) return parsed;
  } catch (err) {
    const parsed = firstJson(err.stdout, err.stderr);
    if (parsed) return parsed;
  }

  const r = spawnSync(SUPABASE_BIN, ["status", "-o", "json"], {
    cwd: REPO,
    shell: false,
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const parsed = firstJson(r.stdout, r.stderr);
  if (parsed) return parsed;

  console.error("[env] could not obtain JSON from `supabase status -o json`.");
  console.error("[env] (no values are shown; inspect manually if this persists)");
  process.exit(1);
}

// ── Field resolution by normalized name, not position ────────────────────────
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

function flatten(obj, out = new Map(), prefix = "") {
  if (obj === null || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") flatten(v, out, path);
    else if (typeof v === "string" && v.length > 0) {
      // Index by leaf name AND full path so aliases can match either.
      if (!out.has(norm(k))) out.set(norm(k), v);
      out.set(norm(path), v);
    }
  }
  return out;
}

function pick(flat, aliases) {
  for (const a of aliases) {
    const hit = flat.get(norm(a));
    if (hit) return hit;
  }
  return null;
}

const status = readStatus();
const flat = flatten(status);

const API_URL = pick(flat, ["API_URL", "apiUrl", "api", "REST_URL", "restUrl"]);
const ANON_KEY = pick(flat, ["ANON_KEY", "anonKey", "anon", "PUBLISHABLE_KEY", "publishableKey"]);
const SERVICE_KEY = pick(flat, ["SERVICE_ROLE_KEY", "serviceRoleKey", "SECRET_KEY", "secretKey"]);

const missing = [];
if (!API_URL) missing.push("API_URL / apiUrl / REST_URL");
if (!ANON_KEY) missing.push("ANON_KEY / anonKey / PUBLISHABLE_KEY");
if (WANT_SERVICE_ROLE && !SERVICE_KEY) missing.push("SERVICE_ROLE_KEY / SECRET_KEY");

if (missing.length > 0) {
  console.error("[env] missing required fields (names only):");
  for (const m of missing) console.error(`        ${m}`);
  console.error(`[env] fields seen: ${flat.size} (names withheld)`);
  process.exit(1);
}

// ── Safety: the API must be loopback. Never point tests at a hosted project ──
let host;
try {
  host = new URL(API_URL).hostname;
} catch {
  console.error("[env] API URL is not a valid URL");
  process.exit(1);
}
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error(`[env] REFUSED: API URL host is "${host}", not loopback.`);
  process.exit(1);
}

// Defence in depth: a hosted project would never be loopback, but assert too.
if (/supabase\.(co|in)/i.test(API_URL)) {
  console.error("[env] REFUSED: API URL looks like a hosted Supabase project.");
  process.exit(1);
}

// ── Write ────────────────────────────────────────────────────────────────────
assertIgnored(ENV_FILE);

const lines = [
  `NEXT_PUBLIC_SUPABASE_URL=${API_URL}`,
  // Only the anonymous/publishable key is exposed to the browser.
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`,
  // The seeded synthetic accounts use @staging.local addresses, so the
  // username→email domain must match for username sign-in to resolve.
  `USERNAME_EMAIL_DOMAIN=staging.local`,
];
if (WANT_SERVICE_ROLE && SERVICE_KEY) {
  // Server-only. Never a NEXT_PUBLIC_ name.
  lines.push(`SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}`);
}

writeFileSync(ENV_FILE, `${lines.join("\n")}\n`, { mode: 0o600 });
chmodSync(ENV_FILE, 0o600);

console.log(
  `[env] wrote .env.local — ${lines.length} variables, mode 0600, values not shown` +
    (WANT_SERVICE_ROLE ? " (incl. server-only service role)" : " (no service-role key)"),
);
process.exit(0);
