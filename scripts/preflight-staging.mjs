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
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

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
let dockerOk = false;
try {
  if (!dockerBin) throw new Error("not found");
  const v = run(dockerBin, ["--version"]);
  try {
    const server = run(dockerBin, ["info", "--format", "{{.ServerVersion}}"]);
    dockerOk = true;
    record("Docker daemon", "PASS", `${v.replace(/^Docker version /, "")} / engine ${server}`);
  } catch {
    record(
      "Docker daemon",
      "FAIL",
      `${v} installed, but the daemon is not responding`,
      "Start Docker Desktop, or inside WSL: sudo systemctl start docker",
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

// ── 2b. WHICH Docker? Desktop cannot enforce loopback publishing on Windows ──
//
// Measured on Docker Desktop 29.6.2 / WSL 2 backend: neither
// default-network-opts nor an explicit per-network host_binding_ipv4 is
// honoured, because host publishing is done by Docker Desktop's Windows-side
// proxy rather than the Linux bridge. Only the native Linux engine inside WSL
// applies the daemon's default binding. This check makes the distinction
// visible instead of leaving it to be rediscovered.
if (dockerOk) {
  let endpoint = "";
  try {
    endpoint = run(dockerBin, ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  } catch {
    /* older CLI */
  }
  const isDesktop =
    /desktop-linux|npipe:|docker_engine/i.test(endpoint) ||
    (process.platform === "win32" && !/^unix:/.test(endpoint));

  if (isDesktop) {
    // FAIL, not WARN. Measured: Docker Desktop publishes on 0.0.0.0 regardless
    // of any daemon or per-network binding option, so the isolation gate cannot
    // hold here. Allowing a warning would let the stack start exposed.
    record(
      "Docker flavour",
      "FAIL",
      `Docker Desktop (${endpoint || "npipe"}) — CANNOT bind published ports to loopback`,
      "Run the stack inside WSL 2 with the native Docker Engine (docs/STAGING.md §9). Docker Desktop publishes on 0.0.0.0 and exposes PostgreSQL to the LAN.",
    );
  } else {
    record("Docker flavour", "PASS", `native engine (${endpoint || "unix socket"})`);
  }

  // The Docker API must never be reachable over TCP.
  record(
    "Docker API not on TCP",
    /tcp:\/\//i.test(endpoint) ? "FAIL" : "PASS",
    /tcp:\/\//i.test(endpoint) ? `endpoint is ${endpoint}` : "unix socket / npipe only",
    "Remove any tcp:// hosts entry from the daemon configuration.",
  );
}

// ── 2c. WSL networking mode — mirrored defeats loopback isolation ────────────
//
// In mirrored mode the WSL VM shares the host's interfaces, so a service bound
// to 127.0.0.1 inside the VM becomes reachable on the host's LAN address. NAT
// mode keeps the VM on its own subnet, which is what the isolation gate needs.
if (process.platform === "linux" || process.platform === "win32") {
  try {
    const cfgPath = process.platform === "win32"
      ? `${process.env.USERPROFILE ?? ""}\\.wslconfig`
      : "/mnt/c/Users/.wslconfig";
    const mirrored =
      existsSync(cfgPath) && /networkingMode\s*=\s*mirrored/i.test(readFileSync(cfgPath, "utf8"));
    if (mirrored) {
      record(
        "WSL networking mode",
        "FAIL",
        "mirrored — the VM shares the host's interfaces",
        "Set networkingMode=NAT in .wslconfig (or remove the line) and run: wsl --shutdown",
      );
    } else {
      record(
        "WSL networking mode",
        "PASS",
        existsSync(cfgPath) ? "NAT (mirrored not enabled)" : "NAT (.wslconfig absent — default)",
      );
    }
  } catch {
    record("WSL networking mode", "WARN", "could not be determined");
  }
}

// ── 2d. Published HostIp + non-loopback listeners, if a stack is running ─────
if (dockerOk) {
  try {
    const names = run(dockerBin, ["ps", "--format", "{{.Names}}"])
      .split("\n")
      .map((s) => s.trim())
      .filter((n) => n.startsWith("supabase_"));

    if (names.length === 0) {
      record("Published port bindings", "PASS", "no stack running — nothing published");
    } else {
      const offenders = [];
      for (const n of names) {
        const ports = run(dockerBin, ["port", n]).trim();
        for (const line of ports.split("\n").filter(Boolean)) {
          // "5432/tcp -> 0.0.0.0:54322"
          const host = line.split("->")[1]?.trim() ?? "";
          if (/^(0\.0\.0\.0|\[::\]|:::)/.test(host)) offenders.push(`${n} ${host}`);
        }
      }
      offenders.length === 0
        ? record("Published port bindings", "PASS", `${names.length} containers, all loopback`)
        : record(
            "Published port bindings",
            "FAIL",
            `wildcard binding: ${offenders.slice(0, 3).join(", ")}`,
            "Stop the stack. Wildcard bindings expose the database to the LAN.",
          );
    }
  } catch {
    record("Published port bindings", "WARN", "could not be inspected");
  }
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

function portOpenOn(host, port) {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port, timeout: 900 });
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

const portInUse = (port) => portOpenOn("127.0.0.1", port);

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

// ── 6. LAN reachability — the check that actually matters ───────────────────
//
// Binding inspection can be misleading: on Docker Desktop the network carried
// host_binding_ipv4=127.0.0.1 and the port still answered on the LAN. The only
// trustworthy test is to dial the host's own non-loopback address and require
// a refusal.
{
  const lanAddrs = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);

  if (lanAddrs.length === 0) {
    record("LAN reachability", "PASS", "no non-loopback IPv4 address on this host");
  } else {
    const reachable = [];
    for (const addr of lanAddrs) {
      for (const [port] of PORTS) {
        if (await portOpenOn(addr, port)) reachable.push(`${addr}:${port}`);
      }
    }
    reachable.length === 0
      ? record("LAN reachability", "PASS", `refused on ${lanAddrs.join(", ")}`)
      : record(
          "LAN reachability",
          "FAIL",
          `REACHABLE: ${reachable.join(", ")}`,
          "Stop the stack immediately — the database is exposed to the local network.",
        );
  }
}

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
