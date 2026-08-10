#!/usr/bin/env node
/**
 * Staging preflight.
 *
 * Checks every prerequisite for the local Supabase stack BEFORE
 * `supabase start` is attempted, because a missing container runtime
 * otherwise surfaces as an opaque failure several minutes into an image pull.
 *
 * Read-only: installs nothing, changes nothing, needs no elevation.
 *
 *   npm run db:preflight
 */

import { execFileSync } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync } from "node:fs";

const results = [];

function run(cmd, args) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  }).trim();
}

function record(name, state, detail, fix) {
  results.push({ name, state, detail, fix });
}

// ── 1. WSL 2 (Windows only) ──────────────────────────────────────────────────
// Checked before Docker because Docker Desktop depends on WSL 2 on Windows.
// The remediation list is printed in check order, so it must read in
// installation order.
if (process.platform === "win32") {
  try {
    // wsl.exe emits UTF-16LE, so it is decoded explicitly rather than as
    // utf8 (which renders every character spaced apart). stderr is captured
    // rather than inherited so wsl's own "not installed" message cannot leak
    // into this report.
    const raw = execFileSync("wsl", ["--status"], {
      timeout: 30_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const text = raw.toString("utf16le");
    const v2 = text.includes("2");
    record(
      "WSL",
      "PASS",
      v2 ? "installed (version 2 available)" : "installed",
      v2 ? undefined : "Run: wsl --set-default-version 2",
    );
  } catch {
    record(
      "WSL 2",
      "FAIL",
      "not installed",
      "In an ADMINISTRATOR PowerShell: wsl --install   (then restart Windows)",
    );
  }
}

// ── 2. Container runtime ─────────────────────────────────────────────────────
/**
 * Resolves the docker executable.
 *
 * A shell started before Docker Desktop was installed keeps a stale PATH, so
 * `docker` can be genuinely installed and working while still not resolvable
 * by name. Falling back to the standard install locations avoids reporting a
 * false negative in exactly the situation this script is most used: right
 * after installing Docker.
 */
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
      execFileSync(c, ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
      });
      return c;
    } catch {
      /* try next */
    }
  }
  return null;
}

const dockerBin = resolveDocker();
try {
  if (!dockerBin) throw new Error("not found");
  const v = run(dockerBin, ["--version"]);
  try {
    const server = run(dockerBin, ["info", "--format", "{{.ServerVersion}}"]);
    record("Docker daemon", "PASS", `${v.replace(/^Docker version /, "")} / engine ${server}`);
  } catch {
    record(
      "Docker daemon",
      "FAIL",
      `${v} installed, but the daemon is not responding`,
      "Start Docker Desktop and wait for the whale icon to stop animating.",
    );
  }
} catch {
  record(
    "Docker",
    "FAIL",
    "not installed or not on PATH",
    "Install Docker Desktop (needs WSL 2 first): https://www.docker.com/products/docker-desktop/",
  );
}

// ── 3. Supabase CLI ──────────────────────────────────────────────────────────
{
  const bin =
    process.platform === "win32"
      ? "node_modules/.bin/supabase.cmd"
      : "node_modules/.bin/supabase";
  existsSync(bin)
    ? record("Supabase CLI", "PASS", "present as a devDependency")
    : record("Supabase CLI", "FAIL", "missing", "Run: npm install");
}

// ── 4. Project files ─────────────────────────────────────────────────────────
for (const [label, path] of [
  ["config.toml", "supabase/config.toml"],
  ["seed.sql", "supabase/seed.sql"],
]) {
  existsSync(path)
    ? record(`supabase/${label}`, "PASS", "present")
    : record(`supabase/${label}`, "FAIL", "missing", "Check out the Phase 2a commit.");
}

// ── 5. Ports ─────────────────────────────────────────────────────────────────
const PORTS = [
  [54321, "API (PostgREST)"],
  [54322, "PostgreSQL"],
  [54323, "Studio"],
  [54324, "Inbucket"],
];

function portInUse(port) {
  return new Promise((resolve) => {
    const sock = createConnection({ host: "127.0.0.1", port, timeout: 900 });
    sock.on("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
    sock.on("timeout", () => {
      sock.destroy();
      resolve(false);
    });
  });
}

const busy = [];
for (const [port, label] of PORTS) {
  if (await portInUse(port)) busy.push(`${port} (${label})`);
}
busy.length === 0
  ? record("Ports 54321-54324", "PASS", "all free")
  : record(
      "Ports 54321-54324",
      "WARN",
      `in use: ${busy.join(", ")}`,
      "If the stack is already running this is expected; otherwise stop the conflicting process.",
    );

// ── Report ───────────────────────────────────────────────────────────────────
const width = Math.max(...results.map((r) => r.name.length));
console.log("\nAreen CUBs Studio - staging preflight\n");
for (const r of results) {
  console.log(`  ${r.state.padEnd(4)}  ${r.name.padEnd(width)}  ${r.detail}`);
}

const failed = results.filter((r) => r.state === "FAIL");
if (failed.length > 0) {
  console.log("\nBlocked. Fix these, in order:\n");
  failed.forEach((r, i) => console.log(`  ${i + 1}. ${r.name}: ${r.fix}`));
  console.log("\nSee docs/STAGING.md section 2. Installing WSL and Docker needs");
  console.log("administrator rights and a restart, so it cannot be done from an");
  console.log("agent session.\n");
  process.exit(1);
}

const warned = results.filter((r) => r.state === "WARN");
if (warned.length > 0) {
  console.log("\nWarnings:");
  warned.forEach((r) => console.log(`  - ${r.name}: ${r.fix}`));
}

console.log("\nAll prerequisites met. Next:\n");
console.log("  npm run db:start     # first run pulls images (~1 GB)");
console.log("  npm run db:reset     # apply 25 migrations + synthetic seed");
console.log("  npm run db:verify    # assert the environment is correct\n");
