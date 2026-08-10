/**
 * Staging lifecycle logic.
 *
 * Pure and dependency-injected so every branch is testable without Docker.
 * The CLI wrappers in scripts/ supply the real adapters; the tests supply
 * fakes. Nothing here calls a process or a socket directly.
 *
 * ── Why this module exists ───────────────────────────────────────────────────
 * `npm run db:stop` was a bare `supabase stop`. It returned before the daemon
 * had finished tearing containers down, so a container count taken straight
 * afterwards reported containers that were already dying. That produced a
 * report of "9 containers" against a stack whose ports were already closed —
 * a false alarm that cost real time to disprove.
 *
 * Shutdown is therefore treated as an operation with a settling period: issue
 * the stop, then POLL until the world agrees, with a bounded timeout, and only
 * then report.
 */

/** Result codes. Exhaustive — the CLI switches on these. */
export const StopResult = {
  ALREADY_STOPPED: "already-stopped",
  STOPPED: "stopped",
  TIMEOUT: "timeout",
  DOCKER_FAILED: "docker-failed",
  PORTS_STILL_LISTENING: "ports-still-listening",
  STALE_CONTAINERS: "stale-containers",
};

export const SUPABASE_PORTS = [54321, 54322, 54323, 54324];

/** A container is "ours" only if it belongs to the Supabase local stack. */
export function isSupabaseContainer(name) {
  return typeof name === "string" && /^supabase_/.test(name.trim());
}

/**
 * Partitions a `docker ps -a` listing into running and non-running Supabase
 * containers. Input is an array of { name, running }.
 */
export function partitionContainers(containers) {
  const ours = (containers ?? []).filter((c) => isSupabaseContainer(c.name));
  return {
    running: ours.filter((c) => c.running).map((c) => c.name),
    stale: ours.filter((c) => !c.running).map((c) => c.name),
  };
}

/**
 * Stops the local staging stack and does not return until the outcome is
 * settled or the timeout expires.
 *
 * Dependencies (all injected):
 *   listContainers()  -> Promise<Array<{name, running}>>   (docker ps -a)
 *   runStop()         -> Promise<void>                     (supabase stop)
 *   isPortListening(p)-> Promise<boolean>
 *   sleep(ms)         -> Promise<void>
 *   now()             -> number (ms)
 *
 * Options:
 *   timeoutMs      overall settling budget
 *   pollIntervalMs gap between polls
 *   removeStale    whether to attempt removal of exited containers
 *   removeContainer(name) -> Promise<void>
 */
export async function stopStaging({
  listContainers,
  runStop,
  isPortListening,
  sleep,
  now = () => Date.now(),
  timeoutMs = 90_000,
  pollIntervalMs = 1_000,
  ports = SUPABASE_PORTS,
  removeStale = false,
  removeContainer = async () => {},
} = {}) {
  const notes = [];

  // ── 1. Observe the world BEFORE issuing a stop ─────────────────────────────
  let before;
  try {
    before = partitionContainers(await listContainers());
  } catch (err) {
    return {
      code: StopResult.DOCKER_FAILED,
      ok: false,
      notes: [`could not list containers: ${err.message}`],
      running: [],
      stale: [],
      listeningPorts: [],
    };
  }

  const listeningBefore = [];
  for (const p of ports) {
    if (await isPortListening(p)) listeningBefore.push(p);
  }

  // Idempotency: nothing running and nothing listening means there is no work.
  // Calling db:stop twice must be safe and must not report an error.
  if (before.running.length === 0 && listeningBefore.length === 0 && before.stale.length === 0) {
    return {
      code: StopResult.ALREADY_STOPPED,
      ok: true,
      notes: ["nothing was running"],
      running: [],
      stale: [],
      listeningPorts: [],
    };
  }

  // ── 2. Issue the stop (tolerated if it fails while containers exist) ───────
  if (before.running.length > 0) {
    try {
      await runStop();
    } catch (err) {
      // `supabase stop` can exit non-zero on an already-degraded stack. That is
      // not automatically fatal: what matters is the state we settle into, so
      // record it and keep polling rather than bailing out early.
      notes.push(`stop command reported: ${err.message}`);
    }
  }

  // ── 3. Poll until settled or the budget is spent ───────────────────────────
  const deadline = now() + timeoutMs;
  let current = before;
  let listening = listeningBefore;

  for (;;) {
    try {
      current = partitionContainers(await listContainers());
    } catch (err) {
      return {
        code: StopResult.DOCKER_FAILED,
        ok: false,
        notes: [...notes, `could not list containers while polling: ${err.message}`],
        running: current.running,
        stale: current.stale,
        listeningPorts: listening,
      };
    }

    listening = [];
    for (const p of ports) {
      if (await isPortListening(p)) listening.push(p);
    }

    if (current.running.length === 0 && listening.length === 0) break;

    if (now() >= deadline) {
      // Distinguish the two failure shapes: containers that will not die, and
      // containers that died while something still holds the port.
      if (current.running.length > 0) {
        return {
          code: StopResult.TIMEOUT,
          ok: false,
          notes: [...notes, `still running after ${timeoutMs}ms`],
          running: current.running,
          stale: current.stale,
          listeningPorts: listening,
        };
      }
      return {
        code: StopResult.PORTS_STILL_LISTENING,
        ok: false,
        notes: [...notes, "containers stopped but ports remain bound"],
        running: [],
        stale: current.stale,
        listeningPorts: listening,
      };
    }

    await sleep(pollIntervalMs);
  }

  // ── 4. Stale (exited but still present) containers ─────────────────────────
  if (current.stale.length > 0) {
    if (removeStale) {
      for (const name of current.stale) {
        try {
          await removeContainer(name);
          notes.push(`removed stale container ${name}`);
        } catch (err) {
          notes.push(`could not remove ${name}: ${err.message}`);
        }
      }
      try {
        current = partitionContainers(await listContainers());
      } catch {
        /* keep the last known state */
      }
    }

    if (current.stale.length > 0) {
      return {
        code: StopResult.STALE_CONTAINERS,
        ok: false,
        notes: [...notes, "exited Supabase containers remain; a later start will hit a name conflict"],
        running: [],
        stale: current.stale,
        listeningPorts: [],
      };
    }
  }

  return {
    code: StopResult.STOPPED,
    ok: true,
    notes,
    running: [],
    stale: [],
    listeningPorts: [],
  };
}

/** Human-readable one-liner for the CLI. */
export function describeStopResult(result) {
  switch (result.code) {
    case StopResult.ALREADY_STOPPED:
      return "Already stopped — 0 containers, 0 listeners.";
    case StopResult.STOPPED:
      return "Stopped — 0 running containers, 0 stale containers, 0 listeners.";
    case StopResult.TIMEOUT:
      return `TIMEOUT — still running: ${result.running.join(", ")}`;
    case StopResult.DOCKER_FAILED:
      return `DOCKER FAILED — ${result.notes.join("; ")}`;
    case StopResult.PORTS_STILL_LISTENING:
      return `PORTS STILL LISTENING — ${result.listeningPorts.join(", ")}`;
    case StopResult.STALE_CONTAINERS:
      return `STALE CONTAINERS — ${result.stale.join(", ")}`;
    default:
      return `Unknown result: ${result.code}`;
  }
}
