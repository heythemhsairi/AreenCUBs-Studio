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

---

## Phase 2c — real PostgreSQL and RLS integration tests

**Status: complete.**

Isolation gate re-run before any test touched the database: preflight all-pass, LAN refused. Stack stopped afterwards — 0 containers, 0 listeners.

### Suite

`npm run test:db` — a **separate** vitest config (`vitest.db.config.ts`) so the default suite stays hermetic and CI needs no Docker. **99 tests across 4 files**, all passing.

| File | Tests | Covers |
|---|---|---|
| `schema.dbtest.mjs` | 33 | migrations 0018-0025: tables, functions, triggers, indexes, policies, constraints, FK cascade |
| `rls.dbtest.mjs` | 27 | `current_role()`, `is_admin()`, fail-closed, admin access, non-admin denial, anonymous |
| `content-os.dbtest.mjs` | 22 | plan/item creation, vocabularies, finding #16 source split, finding #3 overdue posts |
| `finance.dbtest.mjs` | 17 | finding #5 contradictions, stamp migration behaviour, bonus lines |

### How the RLS tests avoid proving nothing

Every assertion runs as an **impersonated** user — `set local role authenticated` plus `request.jwt.claims` — inside a transaction that always rolls back. As the `postgres` superuser RLS is bypassed entirely and all of these would pass vacuously, so the suite asserts up front that `current_user` is not `postgres`, that `is_superuser` is `off`, and that a superuser read returns rows where an orphan read returns none. If impersonation ever silently stops working, those guards fail first.

No application test uses service-role privileges.

### Confirmed: `public.current_role()` behaves correctly after the 0018 fix

Returns `admin` / `worker` / `freelancer` from `profiles`, and is provably *not* the reserved PostgreSQL `current_role` keyword — the built-in returns `authenticated` for every caller, the function returns the application role. Returns NULL for a profile-less user, and `is_admin()` coalesces that to false.

### Migration 21 retry hazard — now empirical

Re-running any of its `CREATE POLICY` statements is rejected with *"already exists"*. A partial apply can never self-heal. The guarded repair migration remains necessary and unapproved.

### NEW HIGH-SEVERITY FINDING — Content OS RLS

Any authenticated identity, **including one with no `profiles` row**, can read, insert, update and delete every client's content. Measured, not inferred. Full evidence and the recommended forward-only fix are in `DECISIONS-NEEDED.md` §1b. **Not fixed here** — tightening RLS is a permission change requiring approval. Current behaviour is pinned by tests so it cannot drift silently.

### Three test defects found and corrected in my own suite

1. **`sqlAs` output parsing** sliced by position; psql emits a command tag per statement, so results were misread. Replaced with sentinel-fenced extraction.
2. **"freelancer cannot mutate a client"** asserted that the statement *throws*. RLS denies an UPDATE by filtering rows, so a statement matching nothing returns success. It briefly looked like a security gap; measuring rows-affected showed **0 rows changed** — RLS was correct all along. The test now asserts rows affected, which is the actual property.
3. **A finance assertion** expected an aggregate difference of exactly 1 DT; the real difference is 597 DT because it also sweeps in the draft-marked-paid invoice. Replaced with an enumeration of the specific hidden documents (`9001:1.00`, `9002:596.00`) — stricter and honest about what is measured.

Also corrected: a data-modifying CTE joined back against its own table returns nothing (PostgreSQL snapshot semantics); and `sqlAs(null, …)` is *not* anonymous — it still presents `role=authenticated`. A separate `sqlAsAnon` using the `anon` role was added, and that distinction is precisely what the Content OS finding turns on.

---

## Phase 2e — production-repair readiness without production access

**Status: complete.** Nothing executed against production.

- `docs/audit/PRODUCTION-DRIFT-DECISION.md` — the full decision tree. Four outcomes (history ends at 0017 / 0018 recorded but objects absent / partial manual application / schema fine but ledger inconsistent), each with the read-only evidence required, the expected migration-list pattern, a forward-only repair strategy, and rollback plus verification.
- `scripts/prod-migration-history.mjs` — guarded read-only wrapper. Verified locally that it **refuses** without `--i-have-approval` and **rejects** any extra argument. It redacts project refs, URLs, connection strings and JWTs from its output, never reads `.env.local`, and never accepts a key as an argument. **Not executed.**
- Service-role rotation checklist, including the step most often missed: **redeploy Vercel**, because env vars are read at build/boot and the old key stays live until then.

**No production repair migration was created.** Writing one before the history is known would be guessing. `.sql.plan` is reserved for non-executable drafts — the extension matters, since the Supabase CLI only picks up `.sql` under `migrations/`.

The rule carried into every branch: **a corrected historical migration will never heal production.** `0003`, `0007` and `0018` were fixed for fresh installs; migrations already recorded as applied — or as failed — do not re-run.

---

## Not yet done

**Phase 2d — browser and hydration verification.** Not started. Requires a Playwright install plus browser binaries, ephemeral local credentials in an ignored temp file inside the WSL clone, and a full e2e pass. Deferred for context, not blocked.

**Phase 2f — dashboard quality audit.** Depends on 2d for evidence.

Both are safe to run locally with the infrastructure already in place. See `SESSION-STATE.md` for the exact resume steps.

---

## Phase 2d — Playwright browser verification — **INCOMPLETE (blocked)**

**Status: scaffolding written and committed. The suite has NEVER been executed. No browser result in this report is real.**

### What exists

- `@playwright/test` as a repository devDependency; Chromium headless shell installed in the WSL runner (free).
- `playwright.config.ts` — server pinned to `TZ=UTC` via `webServer.env`, browser context pinned to `Africa/Tunis`. That asymmetry is the production condition that produced React #418; a matching pair would test nothing.
- Three projects: desktop 1280×720, tablet 768×1024, mobile 390×844.
- `e2e/fixtures.ts` — collects console errors, page errors and failed requests on every test, with a deliberately narrow benign-noise filter.
- `e2e/auth.spec.ts` — unauthenticated redirect, invalid credentials, unknown user, admin login, orphan fail-closed (including that the denial page does not reveal which check failed), protected-route access, role scoping.
- `e2e/dashboard.spec.ts` — 13 routes for console/network cleanliness, Publishing hydration on direct load and client navigation, Clients as the historical control, Content OS reads, finance fixtures, `NaN`/`undefined` money guards, 404 and unknown-record handling.
- `e2e/a11y.spec.ts` — accessible names, keyboard traversal, visible focus, heading order, image alts, `html[lang]`, mobile horizontal-overflow, 44×44 tap targets, gross contrast failures.
- `scripts/run-e2e.sh` — brings the stack up if idle, runs the isolation gate, writes ephemeral credentials to an ignored `.env.local`, builds, runs Playwright, and deletes the credential files on exit via a `trap` (including on failure).

### The blocker

The runner cannot extract the local Supabase credentials. Five evidence-based attempts:

1. `supabase status -o env` via `$(...)` with `2>/dev/null` — empty.
2. Same with `2>&1` — the assignments appear when piped directly to `sed`, but not under command substitution.
3. Local binary (`node_modules/.bin/supabase`) redirected to a file — file written but contains no `KEY=` assignments.
4. Fallback parser for a `label: value` table — no matching lines.
5. Fallback parser for the box-drawn table (`│ label │ value │`) — still no match; the diagnostic dump of field names printed nothing, so the file's actual structure remains unconfirmed.

Two environment quirks compounded the diagnosis and are worth recording:

- **Git Bash rewrites POSIX paths** in commands sent to WSL, so `> /tmp/x` became a Windows path and failed with *"No such file or directory"*. Anything non-trivial must go through a script **file**.
- **The WSL VM stops when idle**, taking the stack with it. One failure was simply a stopped stack, which looked like a credential problem. `run-e2e.sh` now starts the stack if it finds none, so that cause is eliminated.

### What is NOT claimed

No browser test has run. Nothing about hydration, accessibility, responsiveness, console errors or the UI fail-closed path has been verified in a browser during this phase. The Phase 1b hydration fix remains supported only by the deterministic unit tests and the before/after measurement from that phase.

### To unblock

Run inside the WSL clone and share the **field names only** (never values):

```bash
cd ~/AreenCUBs-Studio-staging
./node_modules/.bin/supabase status > /tmp/st.txt 2>&1
sed -E 's/(key|secret|token)[^A-Za-z0-9_]+\S+/\1: <redacted>/Ig' /tmp/st.txt | head -30
```

With the true output shape, `pick()` in `scripts/run-e2e.sh` is a one-line change. Alternatively, write the four values into `~/AreenCUBs-Studio-staging/.env.local` yourself (it is gitignored) and run `npx playwright test` directly — the suite needs nothing else.

---

## Phase 2f — dashboard quality audit — **NOT STARTED**

Depends on Phase 2d for browser evidence. Producing a quality report without it would mean inventing findings, which the brief explicitly forbids.
