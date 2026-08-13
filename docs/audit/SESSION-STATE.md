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

## UI/UX REDESIGN — PHASE 4 DONE BAR ONE ITEM; 5, 6, 7 NOT STARTED

**REDESIGN INCOMPLETE.** Per-surface status and the full defect table are in
`docs/REDESIGN-COVERAGE.md`; the specification is `docs/DESIGN-SYSTEM.md`.

| Phase | Commit | State |
|---|---|---|
| Token foundation, Manrope, override tables deleted | `198d9fc` | done |
| Primitives, touch targets, latent #418 fix | `7c564b1` | done |
| 1-2 Shell + dense shared components | `6b3f47b` | done |
| 3 Charts read tokens at runtime | `f8ef8fc` | done |
| Recovery: /dashboard/finance crash | `8a324cd` | done |
| Recovery: axe contrast + both-theme scanning | `e486a03` | done |
| Recovery: screenshot matrix rebuilt and reviewed | `7030a46` | done |
| 8 (part) the 404 page | `98db605` | done |
| 4a Page identity first, empty states, project health | `1fee874` | done |
| 4b Per-role information hierarchy | `f5ba66c` | done |
| 4c Table-to-mobile-card conversion | — | **NEXT** |
| 5 Finance and documents | — | NOT STARTED |
| 6 Content OS and review | — | NOT STARTED |
| 7 Client portal | — | NOT STARTED |
| 8 (rest) settings, profile, error boundaries | — | NOT STARTED |

### Evidence gates — all green

- **axe 45/45** — 15 screens x 3 viewports, BOTH themes each, no rule excluded.
- **shots** — one sign-in per role, 420 files, reviewed via contact sheets.
- **overflow 2/2** at 390px — new in `e2e/overflow.spec.ts`.
- **roles 33/33** — role scoping unchanged by the hierarchy work.

### RESUME HERE — phase 4c, then 5, 6, 7, 8

**4c — table to mobile card.** The last open phase-4 item. `clients` already
converts (verified in the mobile sheet). Unverified: `projects`, `tasks`,
`services`, `team`, `team/planning`, `calendar`. Note this is a DENSITY and
scanability problem, not a broken layout — `e2e/overflow.spec.ts` is green at
390px, so nothing currently overflows. `src/components/ui/mobile-card.tsx`
already exists; check which lists use it.

**Phase 5 — finance and documents.** Open finding #4: the devis/facture
builders put the form in a narrow left column with a large empty right side at
1280px. Line items, document fields and totals/actions want a purposeful
two-column composition. Print views are CORRECT — reviewed at `desktop-light-
admin-2` — and must not regress. Do not alter TVA behaviour, stored totals,
millime compatibility or issued-document immutability. Do not activate the
money engine.

**Phase 6 — Content OS and review workspace.** Preserve signed URLs, MIME/size
validation, private storage, path scoping, version immutability.

**Phase 7 — client portal.** Must become visibly simpler than the internal
dashboards. No internal notes, employees, finance, identifiers, diagnostics.

**Phase 8 (rest).** Open finding #5: `/dashboard/profile` is a single narrow
column against a large empty right side; settings likewise. The `error.tsx`
boundaries are still **unphotographed** — malformed ids produce `notFound()`,
not a thrown error, so they render the 404. Exercise them at component level
rather than adding a production-reachable failure hook.

### Traps recorded, each of which has cost a session

1. The earlier axe diagnosis was **wrong in every particular**. Trust captured
   stdout over any recorded summary, including one written by a previous
   session.
2. `git status` on the WSL runner reports hundreds of phantom modifications
   right after a `reset --hard` or a cold VM start, then reports clean on the
   next call. Stale stat cache. Do not act on the first reading.
3. `wsl.exe` consumes stdin, so a `while read` loop piping a file list into it
   silently stops after ONE iteration. Redirect `</dev/null` on every call.
4. `npx tsc --noEmit | tail` reports **tail's** exit code. Redirect to a file
   and read `$?`, or the typecheck always looks green.
5. The screenshot harness has twice mislabelled a redirect as route evidence
   (`not-found` photographing the login page; `devis-print` photographing the
   commercial dashboard). Both are now guarded, but check new stops.
6. The full-page capture releases only the VERTICAL axis. Releasing `overflow`
   outright switched off horizontal clipping and manufactured a 484px-wide
   "responsive defect" on a 390px viewport that did not exist.

### Commands

```bash
bash scripts/run-e2e.sh e2e/shots.spec.ts        # ~12 min, 420 shots
node scripts/contact-sheet.mjs e2e/.screens e2e/.sheets
bash scripts/run-e2e.sh e2e/axe.spec.ts          # 45 tests, both themes
bash scripts/run-e2e.sh --project=mobile e2e/overflow.spec.ts
```

Screenshots live in `e2e/.screens`, deliberately NOT under `e2e/.artifacts`:
that is Playwright's `outputDir` and is wiped before every run.

