# Autonomous progress log

Running record of completed phases. Newest last.

---

## Phase 2b — staging lifecycle reliability

**Status: complete.**

### Problem

`npm run db:stop` was a bare `supabase stop`. The command returns before the
Docker daemon has finished tearing containers down, so a container count taken
immediately afterwards is a race. It reported **9 containers** for a stack whose
ports were already closed — a false alarm that took a separate round trip to
disprove. Silent unreliability in the one command whose whole job is to confirm
the database is no longer exposed.

### Change

All decision logic moved into `scripts/lib/staging-lifecycle.mjs`, which is pure
and dependency-injected. `scripts/stop-staging.mjs` supplies the real Docker and
socket adapters and prints the outcome. `db:stop` now points at that script.

Shutdown is treated as an operation with a settling period: issue the stop, then
poll until containers **and** ports agree, with a bounded timeout.

Six distinct outcomes, each with its own exit path — `already-stopped`,
`stopped`, `timeout`, `docker-failed`, `ports-still-listening`,
`stale-containers`. Only the first two exit 0.

Notable behaviours:

- **Idempotent.** Repeated `db:stop` is safe and reports success without issuing a stop.
- **Never touches foreign containers.** Only names matching `^supabase_` are considered; a developer's unrelated Postgres is never stopped.
- **Stale containers are removed.** Exited Supabase containers are what caused the earlier `container name already in use` failure on a subsequent start.
- **A failing stop command is not automatically fatal.** `supabase stop` can exit non-zero on a degraded stack while the containers still go away; the settled state decides.
- **Ports are checked independently of containers.** Containers gone but a port still bound reports `ports-still-listening`, never success.

### Preflight hardening

`Docker flavour` was a WARN and is now a **FAIL**. Measured earlier: Docker
Desktop publishes on `0.0.0.0` regardless of any daemon or per-network binding
option, so the isolation gate cannot hold there. A warning would have allowed an
exposed start.

Preflight now refuses on: Docker Desktop, WSL mirrored networking, a `tcp://`
Docker endpoint, any `0.0.0.0`/`[::]` binding on a running `supabase_*`
container, and — the check that actually matters — **empirical LAN
reachability**, dialling the host's own non-loopback addresses and requiring
refusal. Binding text alone was misleading on Docker Desktop, so it is never
trusted on its own.

### Tests

21 new tests in `scripts/lib/staging-lifecycle.test.mjs`, driven by a fake clock
so they are fast and deterministic. Coverage: delayed shutdown, already-stopped,
idempotency, timeout, stale containers, stale removal, docker failure at start
and mid-poll, stop-command failure with successful settle, port still listening,
foreign-container safety, and per-outcome reporting.

`vitest.config.ts` now includes `scripts/**/*.test.mjs`.

**Totals: 196 tests, 8 files** (was 175 / 7).
