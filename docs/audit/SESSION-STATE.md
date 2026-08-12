# Session state

Written so another session can resume without reconstructing anything. Updated at every phase boundary.

---

## Where things stand

| | |
|---|---|
| Canonical repo | `C:\Users\AreenCubs\AreenCUBs-Studio` (source of truth) |
| Branch | `phase-1-data-integrity` |
| Isolated execution clone | `~/AreenCUBs-Studio-staging` inside Ubuntu / WSL 2 (ext4) |
| Local stack | **stopped** unless a phase is actively testing |
| Production contact | **never** — no query, no migration list, no push, no deploy |

**Sync rule:** the WSL clone is only ever a *runner*. Before any database or end-to-end verification, fast-forward it to the exact canonical commit:

```bash
wsl -d Ubuntu -u root -- bash -lc 'cd /root/AreenCUBs-Studio-staging && git fetch origin && git checkout -q <commit>'
```

`node_modules` is never shared between Windows and WSL. If `command -v npm` in WSL returns a `/mnt/c/...` path, the Linux toolchain is not being used.

---

## Infrastructure (already built, do not rebuild)

- WSL 2, Ubuntu, **NAT** networking (`.wslconfig` absent — defaults). Mirrored networking must never be enabled.
- Native **Docker Engine CE** inside Ubuntu, `unix:///var/run/docker.sock`, API never on TCP.
- `/etc/docker/daemon.json` pins `ip` and `default-network-opts.bridge.host_binding_ipv4` to `127.0.0.1`.
- Docker Desktop is installed but **stopped**, and its `daemon.json` was restored from backup. It cannot enforce loopback publishing on Windows — `db:preflight` now fails on it deliberately.

---

## Standing constraints

- Free and open-source only. No purchases, trials, or paid tiers.
- No production connection, remote query, `db push/pull/dump`, deployment, or Vercel change.
- Never read, print, copy or modify the Windows `.env.local`.
- No key, JWT, password or connection string in output, tests, fixtures, docs or Git.
- Synthetic `.invalid` users and fabricated business data only.
- Money module stays disconnected from persistence; financial behaviour unchanged.
- No new roles/permissions without an approved specification. No RLS weakening.
- Stop the stack whenever it is not actively under test.

---

## Resume checklist

```bash
cd /c/Users/AreenCubs/AreenCUBs-Studio
git rev-parse --abbrev-ref HEAD     # phase-1-data-integrity
git status --short                  # must be empty
npm run test:run                    # see AUTONOMOUS-PROGRESS.md for the current total
```

Then read, in order:

1. `docs/audit/AUTONOMOUS-PROGRESS.md` — what is done and what is next
2. `docs/audit/DECISIONS-NEEDED.md` — everything blocked on approval
3. `docs/audit/PHASE-0-DISCOVERY.md` — the confirmed issue register
4. `docs/STAGING.md` — how to run the isolated stack

---

## Next steps (in order)

1. **Phase 2d — browser/hydration verification.** Not started.
   - `npm i -D @playwright/test && npx playwright install chromium` (free)
   - Generate ephemeral local Supabase keys from `npm run db:status` into an **ignored** temp env file inside the WSL clone. Never print, never commit, delete afterwards.
   - Cover: synthetic admin login, missing-profile fail-closed, Content OS plan creation, Publishing hydration under UTC-server vs Africa/Tunis-browser, finance pages against the contradiction fixture, navigation and error states.
   - Responsive at mobile / tablet / desktop; focused a11y (keyboard, visible focus, labels, dialogs, contrast).
   - Screenshots must contain fabricated data only.
2. **Phase 2f — dashboard quality audit**, using 2d evidence.

Run database and browser work **only** inside WSL, prove isolation first, stop the stack after.

## Current totals

| | |
|---|---|
| Unit tests | **197** (8 files) — `npm run test:run`, no Docker needed |
| Database tests | **99** (4 files) — `npm run test:db`, requires the WSL stack |
| Build | clean, **52 routes** |
| Typecheck | clean |

## Commits this session

`dae79f2` Phase 2b · `6a7fce7` Phase 2c · Phase 2e (this commit)

---

## Continuation point (updated)

**HEAD:** see `git log -1`. Branch `phase-1-data-integrity`. Tree clean.

### Safe local preview

```bash
wsl -d Ubuntu
cd ~/AreenCUBs-Studio-staging
npm run preview:local     # isolation gate, synthetic DB, app on 127.0.0.1:3000
npm run preview:stop      # tears down and PROVES it; nonzero if incomplete
```

Open **http://127.0.0.1:3000/dashboard**. Synthetic logins (fabricated, local DB only):
`admin` / `worker` / `freelancer`, password `staging-only-not-a-secret`; `orphan` is authenticated with no profile and must be denied.

### Master-brief phase status

| Phase | Status |
|---|---|
| 1A `/dashboard/team` hydration | **NOT DONE** — 3 browser failures. Bisection plan in PHASE-2F. |
| 1B accessibility labels | ✅ done (`4438079`), verified in browser |
| 1C contrast / design tokens | **NOT STARTED** — axe reports `color-contrast` on every route |
| 2 role & permission architecture | **NOT STARTED** — DB has 3 roles; commercial/intern/client are greenfield |
| 3 Content OS authorization | interim containment done (`8c21885`); full 6-role model not started |
| 4 commercial dashboard | **NOT STARTED** |
| 5 intern dashboard | **NOT STARTED** |
| 6 client portal | **NOT STARTED** |
| 7 video review + storage provider | **NOT STARTED** |
| 8 optional TVA | module built & tested (`eceab3d`), **not wired**; divergence unapproved |
| 9 task/project operations | existing features only; import workflow not started |
| 10 reporting | **NOT STARTED** |
| 11 design system rollout | **NOT STARTED** |
| 12 safe local preview | ✅ done |

### Recommended next order

1. **Phase 1C contrast** — axe evidence exists, token-level fix, self-contained.
2. **Phase 2 role schema + RLS** — everything from Phase 3 onward depends on it. Start with the permission matrix document, then a forward-only migration adding roles and membership/assignment tables, then RLS tests per role.
3. **Phase 1A hydration** — use production-build component bisection; the dev-server harness failed three times.

Phases 4–7 and 10 are each multi-session features. Do not start one without room to finish and verify it.

---

## Continuation point — 37a015a

**Program is now persistent.** A session needs only: `Continue.` See `CLAUDE.md` and `docs/audit/MASTER-IMPLEMENTATION-ROADMAP.md`.

### In progress: Phase 1 — contrast and semantic design tokens

**Done:** the two largest light-theme offenders fixed at their true source (the light-theme override block in globals.css, NOT the custom properties — a first attempt at the tokens changed nothing, because those elements do not consume them).

- `#6C8298` → `#556575` (30+ nodes; 3.97 → 5.99:1 on white)
- `#1A9DBF` → `#0E6C87` (13 nodes; 2.92 → 5.50:1 on #F0F6FF)

**Next, immediately:** the remaining long tail, each 1–7 nodes, all on light surfaces:

| Pair | Ratio | Source |
|---|---|---|
| `#7c848f` on `#ffffff` | 3.78 | `text-ink/NN` opacity blend |
| `#74767c` on `#f5f9ff` | 4.29 | `text-ink/NN` opacity blend |
| `#f43f5e` on `#feecef` | 3.22 | danger badge |
| `#7dd3fc` on `#e1f5fe` | 1.48 | info badge |
| `#22c55e` on `#ffffff` | 2.27 | success (24px, needs 3:1) |
| `#fcd34d` on `#fdecce` | 1.24 | warning badge |
| `#fb7185` / `#f4627d` / `#a78bfa` | 2.0–2.7 | badge tints |

Badges need a per-tone foreground/background token pair (one darkened foreground per tint), not a single global change. The opacity-derived greys need the `ink` blends raising or replacing with solid tokens.

**How to get the evidence:** `e2e/axe.spec.ts` now prints the exact failing colour pairs with ratios and font sizes. Run:

```bash
cd ~/AreenCUBs-Studio-staging && bash scripts/run-e2e.sh --project=desktop -g axe
```

Still outstanding for Phase 1: light AND dark theme verification, and fabricated-data screenshots at all three viewports.

### Then: Phase 2 — role schema and complete RLS matrix

Write the permission matrix first. Everything from Phase 3 onward depends on it.

### Totals at this commit

200 unit · 103 database · typecheck clean · build clean 52 routes. Axe still fails on the remaining tail (deliberately — real defects, not suppressed).

---

## UI/UX REDESIGN — PHASES 1-4 DONE, 5-8 NOT STARTED, AXE IS RED

**REDESIGN INCOMPLETE.** Per-surface status with ✅/◐/⬜ is in
`docs/REDESIGN-COVERAGE.md`; the specification is `docs/DESIGN-SYSTEM.md`.

| Phase | Commit | State |
|---|---|---|
| Token foundation, Manrope, override tables deleted | `198d9fc` | ✅ |
| Primitives, touch targets, latent #418 fix | `7c564b1` | ✅ |
| 1-2 Shell + dense shared components | `6b3f47b` | ✅ |
| 3 Charts read tokens at runtime | `f8ef8fc` | ✅ |
| 4 Dashboards: real headings, twitch removed | `2270f5a` | ◐ partial |
| Config gradients tokenised; open defect recorded | `97bbf5c` | — |
| 5 Finance and documents | — | ⬜ |
| 6 Content OS and review | — | ⬜ |
| 7 Client portal and external states | — | ⬜ |
| 8 Settings, profile, remaining routes | — | ⬜ |

### FIX THIS FIRST — axe regression, 14 failures

```
#ffffff on #3b8bba = 3.75:1   (10pt / 13.33px)
```

`#3B8BBA` is the pre-token brand colour. axe was **14/14 green at `198d9fc`**,
so phases 1-4 introduced it — most likely *uncovered* it, since deleting the
override tables stopped a patch from repainting it. It appears on every route
**including `/login` and `/account-unavailable`**, which have no shell.

Already ruled out, with evidence (see `REDESIGN-COVERAGE.md`): not a Tailwind
class — the built CSS in `.next/static/css` emits no such rule; not
`theme.backgroundImage` — tokenising it changed nothing; not `brand.DEFAULT`.

**The next command**, and it matters because the obvious approach is a trap —
the failing selector goes to **stdout**, not into `error-context.md`, which
holds the spec source:

```bash
bash scripts/run-e2e.sh --project=desktop -g "login page has no serious" 2>&1 | grep -A6 "\[axe\]"
```

The `e.g. [...]` line names the element. Because it renders on `/login`, look at
the root layout, `LanguageToggle`, `ThemeToggle`, `Toaster` — and at any inline
`style`, since the colour is not in the stylesheet.

### THEN — resume at phase 5

1. **Finance and documents**: finance, quotes, invoices, builders, detail/edit,
   print. Must not alter TVA behaviour, totals, millime compatibility or
   issued-document immutability.
2. **Content OS and review**, preserving signed-URL and storage boundaries.
3. **Client portal** — must become visibly *simpler* than the internal
   dashboards, with no internal notes, people, finance or diagnostics.
4. **Settings, profile, login, account-unavailable, 404, error states.**

Also unfinished in phase 4: genuine per-role information hierarchy — what a
commercial, intern or freelancer should see *first*, based on what they can act
on. Only the heading structure was fixed.

### Screenshot matrix

`e2e/shots.spec.ts` — 6 roles × their reachable routes × both themes × 3
viewports, plus unauthenticated states. **It is BROKEN: 117 failed / 15 passed
over 1.3 hours**, measured across two full runs.

The filter collision with the old spec was real but secondary. The spec runs
~174 tests and each performs its **own sign-in**; the dev server saturates, the
login form stops rendering inside the timeout, and every later test fails in
`beforeEach` — which makes a load problem look like a login bug.

Fix: sign in **once per role**, not once per test. Either reuse a Playwright
`storageState` per role, or collapse each role into a single test that walks
its routes in a loop taking both themes at each stop. That is six logins
instead of 174. Then re-run and actually **look at the images** — the matrix
exists for human inspection, and nobody has inspected these.



The implementation programme and the independent audit are complete
(`COMPLETION-REPORT.md`, `INDEPENDENT-AUDIT.md`). A full visual redesign began
on top of them. **Two phases are committed; the route-level pass is not done.**

| Phase | Commit | What landed |
|---|---|---|
| Token foundation | `198d9fc` | Areen palette, both themes, Manrope, codemod, both override tables deleted |
| Primitives | `7c564b1` | Button/Card, touch targets, and a latent #418 fix |

Specification: **`docs/DESIGN-SYSTEM.md`** — tokens, type, depth, motion, touch
targets, the skills synthesised, and the deliberate deviations.

### What is DONE

- `src/styles/tokens.css`: one role-based system, RGB triplets so opacity
  modifiers work, dark as the base and `.light` as the opt-in.
- **~560 lines of `!important` theme patches deleted.** Components name roles;
  the legacy names (`ink`, `cream`, `brand`, `accent`) point at the same tokens,
  which fixed 419 `text-ink` uses without a 419-site edit.
- 1,189 hex classes + 362 named-palette classes migrated by codemod.
- Manrope (SIL OFL, variable axis) with Noto Sans Arabic kept **inside** the
  sans stack — dropping that fallback breaks every Arabic glyph.
- Button/Card visual layer, `pointer-coarse:` variant registered.
- **axe 14/14, zero violations, both themes.**

### RESUME HERE — the route-level pass

The foundation propagates colour and type everywhere automatically, so no route
is broken — but no route has had its **layout** redesigned yet. In priority
order:

1. **Shell** — sidebar, topbar, mobile nav, page header. The rail is already
   navy in both themes via `--ac-rail`; the layout and density are untouched.
2. **Dense tables** — desktop density and the intentional conversion to mobile
   cards rather than horizontal overflow.
3. **KPI cards, charts** — the six-colour chart ramp exists in tokens but the
   chart components still pass their own colours in places.
4. **Per-route layout** — dashboards, finance, Content OS, portal, review.

### Known follow-ups

- **20+ ambient `toLocale*` calls** remain (`grep -rn "toLocale" src | grep -v
  timeZone`). Most operate on date-only strings, which are safe at UTC+1;
  timestamps are not. One caused a deterministic #418 on `/dashboard/clients`
  the moment this session crossed midnight. Fix with `formatDate` from
  `src/lib/format.ts`, and verify by running the test **twice** — a
  time-dependent failure that passes once proves nothing.
- ~160 hex literals remain in `.tsx`, mostly in charts and print views.
- `globals.css` still holds legacy `--c-*` variables and component classes that
  the `--ac-*` roles supersede; safe to retire incrementally.

### Gate baseline for this work

Baseline screenshots (pre-redesign) are in `/root/baseline` inside the runner,
36 PNGs. The redesign matrix regenerates to `e2e/.artifacts/screens`.

## PROGRAMME COMPLETE — then independently audited

All twelve phases are done (`COMPLETION-REPORT.md`). A fresh evidence-based
audit followed, treating the recorded-complete state as untrusted:
`INDEPENDENT-AUDIT.md`.

**Three defects confirmed and fixed**, each with a test that fails without it:

| | Commit |
|---|---|
| The client portal had no error boundary — `error.message` and `error.digest` shown to external contacts | `d7b7bec` |
| A commercial was offered a media control that redirected them off the page | `ee6702a` |
| A TVA-disabled document stated a rate — including on every line of the printed document | `530627d` |

**Measured clean and now pinned** (`08e7f16`): the seven owner-run views grant
`authenticated:SELECT` and nothing else, refuse `anon` outright, and return
zero to a session with no membership. Tests enumerate views by pattern, so one
added later is covered the day it appears.

Database posture, measured: no `public` table without RLS; no RLS-enabled table
without policies; no `SECURITY DEFINER` function with an unpinned `search_path`;
`anon` reaches zero rows everywhere.

**Final gates, all green:** 34 migrations from zero · typecheck · build ·
244 unit · 268 database · **302 browser tests across three viewports** ·
axe zero serious/critical · 36 screenshots · secret scan clean (three matches
inspected and confirmed placeholders in `.env.example` and the loopback default
in `docs/STAGING.md`) · stack stopped with 0 containers, 0 listeners.

Nothing further is safe to do autonomously. What remains is owner action —
key rotation first, then the production schema baseline that gates every
migration rollout.

### Two process notes for the next session

- `mksync.sh` runs `git add -A` as a side effect. It swept two unrelated audit
  fixes into one commit; they were split before anything built on top. **Commit
  before syncing**, or stage explicitly afterwards.
- The runner is synced by tar, so its git HEAD stops describing its files.
  `resync-runner.sh <commit>` hard-resets it (runner only — the canonical repo
  is fetched read-only) and must run **before** the working tree is layered on,
  or git refuses rather than clobbering.

### The environment traps, still true

1. `SECURITY DEFINER` makes `current_user` the owner — identify callers by `auth.uid()`.
2. Assert rows affected, never "did it throw".
3. CLI skips future-dated migrations silently.
4. `git archive` scopes to the shell cwd — run from repo root.
5. Backslash escapes collapse in Bash heredocs — use the Write tool; char codes beat regex classes.
6. Browser tests persist writes — reset fixtures (incl. `storage.objects` rows via `session_replication_role = replica`).
7. The WSL VM idles out between tool calls; cold boots look like DB crashes — wait for health.
8. The WSL clone is synced by tar; verify provenance against the Windows repo.

### Open items (`DECISIONS-NEEDED.md`)

§1 key rotation · §11b/§11c scope decisions · §14 production schema unknown ·
millimes engine · Drive connection · Clear Sans licence.
