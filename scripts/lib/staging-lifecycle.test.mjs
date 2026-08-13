import { describe, it, expect, vi } from "vitest";
import {
  StopResult,
  SUPABASE_PORTS,
  isSupabaseContainer,
  partitionContainers,
  stopStaging,
  describeStopResult,
} from "./staging-lifecycle.mjs";

/**
 * Lifecycle tests.
 *
 * The defect these exist to prevent: `db:stop` counted containers immediately
 * after issuing the stop, before the daemon had finished, and reported nine
 * live containers for a stack whose ports were already closed. Every case
 * below drives the settling loop with a fake clock, so the suite stays fast
 * and deterministic.
 */

/** Builds an injectable world whose container list changes over time. */
function world({
  frames, // array of container arrays, consumed one per listContainers() call
  listening = [], // ports listening; can be a function of call index
  stopThrows = null,
  listThrows = null,
  timeoutMs = 5_000,
  pollIntervalMs = 1_000,
  removeStale = false,
} = {}) {
  let listCalls = 0;
  let portCalls = 0;
  let clock = 0;

  const removed = [];

  const deps = {
    listContainers: async () => {
      if (listThrows && listCalls >= listThrows.afterCalls) {
        throw new Error(listThrows.message);
      }
      const frame = frames[Math.min(listCalls, frames.length - 1)];
      listCalls++;
      return frame;
    },
    runStop: async () => {
      if (stopThrows) throw new Error(stopThrows);
    },
    isPortListening: async (p) => {
      const set = typeof listening === "function" ? listening(portCalls++) : listening;
      return set.includes(p);
    },
    // Fake clock: sleeping advances time instead of waiting.
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    timeoutMs,
    pollIntervalMs,
    removeStale,
    removeContainer: async (name) => {
      removed.push(name);
    },
  };

  return { deps, removed, calls: () => listCalls };
}

const running = (...names) => names.map((name) => ({ name, running: true }));
const exited = (...names) => names.map((name) => ({ name, running: false }));

// ── Helpers ──────────────────────────────────────────────────────────────────

describe("isSupabaseContainer", () => {
  it("matches only the local Supabase stack", () => {
    expect(isSupabaseContainer("supabase_db_abc")).toBe(true);
    expect(isSupabaseContainer("supabase_kong_abc")).toBe(true);
  });

  it("never claims unrelated containers", () => {
    // Guards against a stop routine that would tear down a user's other work.
    for (const n of ["my_postgres", "redis", "", null, undefined, "notsupabase_db"]) {
      expect(isSupabaseContainer(n)).toBe(false);
    }
  });
});

describe("partitionContainers", () => {
  it("splits running from exited and ignores foreign containers", () => {
    const p = partitionContainers([
      { name: "supabase_db_x", running: true },
      { name: "supabase_kong_x", running: false },
      { name: "unrelated_app", running: true },
    ]);
    expect(p.running).toEqual(["supabase_db_x"]);
    expect(p.stale).toEqual(["supabase_kong_x"]);
  });

  it("handles an empty or missing list", () => {
    expect(partitionContainers([])).toEqual({ running: [], stale: [] });
    expect(partitionContainers(undefined)).toEqual({ running: [], stale: [] });
  });
});

// ── Already-stopped / idempotency ────────────────────────────────────────────

describe("already-stopped state", () => {
  it("reports ALREADY_STOPPED without issuing a stop", async () => {
    const w = world({ frames: [[]], listening: [] });
    const runStop = vi.fn();
    const r = await stopStaging({ ...w.deps, runStop });
    expect(r.code).toBe(StopResult.ALREADY_STOPPED);
    expect(r.ok).toBe(true);
    expect(runStop).not.toHaveBeenCalled();
  });

  it("is idempotent — repeated calls stay successful", async () => {
    for (let i = 0; i < 3; i++) {
      const w = world({ frames: [[]], listening: [] });
      const r = await stopStaging(w.deps);
      expect(r.ok).toBe(true);
      expect(r.code).toBe(StopResult.ALREADY_STOPPED);
    }
  });

  it("ignores unrelated running containers", async () => {
    const w = world({ frames: [[{ name: "some_other_app", running: true }]], listening: [] });
    const r = await stopStaging(w.deps);
    expect(r.code).toBe(StopResult.ALREADY_STOPPED);
  });
});

// ── Delayed shutdown — the actual production defect ──────────────────────────

describe("delayed container shutdown", () => {
  it("waits for containers to disappear instead of counting immediately", async () => {
    // Containers linger for three polls, then go. A naive implementation
    // reports them as still running; this must settle to STOPPED.
    const w = world({
      frames: [
        running("supabase_db_x", "supabase_kong_x"),
        running("supabase_db_x", "supabase_kong_x"),
        running("supabase_db_x"),
        [],
      ],
      listening: [],
    });
    const r = await stopStaging(w.deps);
    expect(r.code).toBe(StopResult.STOPPED);
    expect(r.ok).toBe(true);
    expect(r.running).toEqual([]);
    expect(w.calls()).toBeGreaterThan(2);
  });

  it("waits for ports to close even after containers are gone", async () => {
    let poll = 0;
    const w = world({
      frames: [running("supabase_db_x"), [], [], []],
      // Port stays bound for the first two checks, then releases.
      listening: () => (poll++ < 3 ? [54322] : []),
    });
    const r = await stopStaging(w.deps);
    expect(r.code).toBe(StopResult.STOPPED);
    expect(r.listeningPorts).toEqual([]);
  });
});

// ── Timeout ──────────────────────────────────────────────────────────────────

describe("timeout state", () => {
  it("reports TIMEOUT when containers never stop", async () => {
    const w = world({
      frames: [running("supabase_db_x")],
      listening: [],
      timeoutMs: 3_000,
      pollIntervalMs: 1_000,
    });
    const r = await stopStaging(w.deps);
    expect(r.code).toBe(StopResult.TIMEOUT);
    expect(r.ok).toBe(false);
    expect(r.running).toContain("supabase_db_x");
  });

  it("does not loop forever", async () => {
    const w = world({
      frames: [running("supabase_db_x")],
      listening: [],
      timeoutMs: 2_000,
      pollIntervalMs: 500,
    });
    const r = await stopStaging(w.deps);
    expect(r.ok).toBe(false);
    expect(w.calls()).toBeLessThan(50);
  });
});

// ── Ports still listening ────────────────────────────────────────────────────

describe("port still listening after container shutdown", () => {
  it("reports PORTS_STILL_LISTENING rather than declaring success", async () => {
    const w = world({
      frames: [running("supabase_db_x"), [], [], []],
      listening: [54322], // never releases
      timeoutMs: 3_000,
      pollIntervalMs: 1_000,
    });
    const r = await stopStaging(w.deps);
    expect(r.code).toBe(StopResult.PORTS_STILL_LISTENING);
    expect(r.ok).toBe(false);
    expect(r.listeningPorts).toContain(54322);
  });

  it("checks every Supabase port", async () => {
    expect(SUPABASE_PORTS).toEqual([54321, 54322, 54323, 54324]);
    const seen = [];
    const w = world({ frames: [[]], listening: [] });
    await stopStaging({
      ...w.deps,
      isPortListening: async (p) => {
        seen.push(p);
        return false;
      },
    });
    expect(seen).toEqual(SUPABASE_PORTS);
  });
});

// ── Stale containers ─────────────────────────────────────────────────────────

describe("stale container state", () => {
  it("reports STALE_CONTAINERS when exited containers remain", async () => {
    // This is what caused the earlier "container name already in use" failure
    // after a killed start — exited containers that a later start collides with.
    const w = world({ frames: [running("supabase_db_x"), exited("supabase_db_x")], listening: [] });
    const r = await stopStaging(w.deps);
    expect(r.code).toBe(StopResult.STALE_CONTAINERS);
    expect(r.ok).toBe(false);
    expect(r.stale).toContain("supabase_db_x");
  });

  it("removes them when asked, then reports success", async () => {
    const w = world({
      frames: [running("supabase_db_x"), exited("supabase_db_x"), []],
      listening: [],
      removeStale: true,
    });
    const r = await stopStaging(w.deps);
    expect(r.code).toBe(StopResult.STOPPED);
    expect(w.removed).toContain("supabase_db_x");
  });

  it("treats a purely stale stack as work to be done, not as already-stopped", async () => {
    const w = world({ frames: [exited("supabase_db_x"), exited("supabase_db_x")], listening: [] });
    const r = await stopStaging(w.deps);
    expect(r.code).toBe(StopResult.STALE_CONTAINERS);
  });
});

// ── Docker failures ──────────────────────────────────────────────────────────

describe("docker command failure", () => {
  it("reports DOCKER_FAILED when the daemon cannot be queried at all", async () => {
    const r = await stopStaging({
      listContainers: async () => {
        throw new Error("Cannot connect to the Docker daemon");
      },
      runStop: async () => {},
      isPortListening: async () => false,
      sleep: async () => {},
      now: () => 0,
    });
    expect(r.code).toBe(StopResult.DOCKER_FAILED);
    expect(r.ok).toBe(false);
    expect(r.notes.join(" ")).toMatch(/Cannot connect/);
  });

  it("reports DOCKER_FAILED if listing breaks mid-poll", async () => {
    const w = world({
      frames: [running("supabase_db_x"), running("supabase_db_x")],
      listening: [],
      listThrows: { afterCalls: 1, message: "daemon went away" },
    });
    const r = await stopStaging(w.deps);
    expect(r.code).toBe(StopResult.DOCKER_FAILED);
  });

  it("keeps polling when the stop COMMAND fails but the daemon still answers", async () => {
    // `supabase stop` can exit non-zero on a degraded stack while the
    // containers still go away. The settled state is what matters.
    const w = world({
      frames: [running("supabase_db_x"), []],
      listening: [],
      stopThrows: "supabase stop exited 1",
    });
    const r = await stopStaging(w.deps);
    expect(r.code).toBe(StopResult.STOPPED);
    expect(r.ok).toBe(true);
    expect(r.notes.join(" ")).toMatch(/exited 1/);
  });
});

// ── Reporting ────────────────────────────────────────────────────────────────

describe("describeStopResult", () => {
  it("produces a distinct message per outcome", () => {
    const messages = [
      StopResult.ALREADY_STOPPED,
      StopResult.STOPPED,
      StopResult.TIMEOUT,
      StopResult.DOCKER_FAILED,
      StopResult.PORTS_STILL_LISTENING,
      StopResult.STALE_CONTAINERS,
    ].map((code) =>
      describeStopResult({ code, running: ["a"], stale: ["b"], listeningPorts: [1], notes: ["n"] }),
    );
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("never claims success for a failure code", () => {
    for (const code of [StopResult.TIMEOUT, StopResult.DOCKER_FAILED, StopResult.PORTS_STILL_LISTENING]) {
      const msg = describeStopResult({ code, running: [], stale: [], listeningPorts: [], notes: [] });
      expect(msg.toLowerCase()).not.toMatch(/^stopped|^already stopped/);
    }
  });
});
