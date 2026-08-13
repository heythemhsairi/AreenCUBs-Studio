#!/usr/bin/env node
/**
 * `npm run db:stop`
 *
 * Thin adapter around scripts/lib/staging-lifecycle.mjs, which holds all the
 * decision logic and is unit-tested. This file only supplies real Docker and
 * socket implementations, then prints the outcome.
 *
 * Exit codes: 0 stopped or already stopped, 1 anything else.
 */

import { execFileSync } from "node:child_process";
import { createConnection } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { existsSync } from "node:fs";
import {
  StopResult,
  SUPABASE_PORTS,
  stopStaging,
  describeStopResult,
} from "./lib/staging-lifecycle.mjs";

function resolveDocker() {
  const candidates = ["docker"];
  if (process.platform === "win32") {
    candidates.push(
      `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Docker\\Docker\\resources\\bin\\docker.exe`,
    );
  } else {
    candidates.push("/usr/bin/docker", "/usr/local/bin/docker");
  }
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
if (!docker) {
  console.error("Docker not found — cannot verify the stack is stopped.");
  process.exit(1);
}

/** `docker ps -a` including exited containers, so stale ones are visible. */
async function listContainers() {
  const out = execFileSync(docker, ["ps", "-a", "--format", "{{.Names}}\t{{.State}}"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  });
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, state] = l.split("\t");
      return { name, running: state === "running" };
    });
}

async function runStop() {
  const bin = existsSync("node_modules/.bin/supabase")
    ? "node_modules/.bin/supabase"
    : "npx";
  const args = bin === "npx" ? ["--yes", "supabase", "stop", "--no-backup"] : ["stop", "--no-backup"];
  execFileSync(bin, args, { stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 });
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const sock = createConnection({ host: "127.0.0.1", port, timeout: 800 });
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

async function removeContainer(name) {
  execFileSync(docker, ["rm", "-f", name], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
}

const result = await stopStaging({
  listContainers,
  runStop,
  isPortListening,
  sleep: (ms) => delay(ms),
  timeoutMs: 90_000,
  pollIntervalMs: 1_500,
  ports: SUPABASE_PORTS,
  // Exited Supabase containers cause "container name already in use" on the
  // next start, so clear them as part of a clean stop.
  removeStale: true,
  removeContainer,
});

console.log(`\n${describeStopResult(result)}`);
for (const n of result.notes) console.log(`  - ${n}`);

if (!result.ok) {
  console.log("\nThe stack is NOT confirmed stopped. Do not assume it is closed.");
  process.exit(1);
}

console.log(`  ports checked: ${SUPABASE_PORTS.join(", ")} — none listening`);
process.exit(result.code === StopResult.ALREADY_STOPPED ? 0 : 0);
