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

## Continuation point — Phase 6 complete, HEAD 9f77812

Branch `phase-1-data-integrity`. Phases 1–6 are done and committed.

| Phase | Commit | What landed |
|---|---|---|
| 2 — roles and RLS | `b2bc5b9` | Six-role matrix, `client_members`, `client_directory`, audit log, column guards |
| 3 — /dashboard/team | `e146f30` | Was a server-render throw, not a hydration mismatch |
| 4 — commercial | `a2578c3` | Commercial dashboard, `requireQuoteAccess`, scoped devis/factures |
| 5 — intern | `d51a64a` | Intern dashboard, `requireClientAccess`, navigation for the new roles |
| 6 — client portal | `9f77812` | Portal views, `portal_set_approval`, notifications, audit |
| 7 — video review | `da4d471` | Schema, permissions, portal surface, private bucket — **UI pending** |

### Where the boundaries actually live

**Role scope is in the database, never in a component.** Every dashboard reads
through the RLS-bound client and does no filtering of its own — if a page had to
filter, the policy would not be doing its job. `commercial_owns_client()`,
`assigned_to_task()`, `client_contact_of()` are the definitions.

**The commercial and intern dashboards branch BEFORE any query runs**, in
`src/app/dashboard/page.tsx`. The surest way not to show agency finance is never
to ask for it; a conditional around markup leaves the number one refactor from
being rendered.

**Guards are allow-lists.** `requireInternal`, `requireQuoteAccess`,
`requireClientAccess`, `requireClientContact`. A role nobody has thought of yet
reaches nothing.

**Column containment is done with views, because RLS cannot do it.**
`client_directory` for intern/freelancer, `portal_*` for the client role. Each
is owner-run, carries its own membership filter, and is explicitly
`REVOKE`d — a single-table view is auto-updatable and Supabase grants ALL to
`authenticated` by default, which made `client_directory` writable until a test
tried it.

### Traps this program has already paid for

1. **`SECURITY DEFINER` changes `current_user` to the function's owner.** Both
   Phase 2 guard triggers silently permitted every write they existed to stop
   until they were made invoker-rights.
2. **Assert rows AFFECTED, never whether a statement threw.** RLS denies writes
   by filtering. The pre-existing escalation test measured after a rollback and
   therefore could not fail.
3. **Supabase CLI 2.98.2 silently skips migrations dated in the future.** Files
   named `20260812*` were ignored with no warning while `20260811*` applied.
4. **`git archive` scopes to the shell's current directory.** Run it from the
   repo root or it silently archives a subtree.
5. **Backslash escapes collapse in Bash-tool heredocs.** `"\n"` inside a Python
   heredoc lands as a literal newline in the output file — twice this produced a
   JS parse error that took a whole suite out of the run while the summary still
   read "passed". Write such scripts with the Write tool instead.
6. **Browser tests are not rolled back.** Anything an e2e test writes persists;
   restore the fixture or assert a delta.

### Environment — syncing to the WSL clone

`rsync` across `/mnt/c` stalls indefinitely. Use the tar stream:

```bash
bash /c/Users/AreenCubs/mksync.sh                    # git archive of the staged tree
wsl -d Ubuntu -u root -- bash -lc 'bash /root/run.sh <task>.sh'
```

`run.sh` re-copies its helpers each call because WSL clears `/tmp` when the
instance idles out. `.gitattributes` pins `*.sh` to LF; `extract.sh` normalises
again on arrival.

### Phase 7 — video review — commit `da4d471`, PARTIAL

**Done and tested:** `review_assets`, `review_versions`, `review_comments`; the
scope helpers; RLS for all five internal roles; three `portal_review_*` views;
`portal_add_review_comment()`; a private `review-media` bucket with path-scoped
policies. 16 tests.

Storage paths are `<client_id>/<asset_id>/<file>` and the policy reads the first
segment back as the owning organisation — `storage.objects` has no foreign key
into this schema, so the path IS the relationship. A malformed path fails the
uuid guard and is denied.

**Not built yet — this is where to resume:**

1. **Internal upload page** (`/dashboard/review`). Staff create an asset, upload
   a version to `review-media` under the path convention above, and see the
   comment thread. Validate mime (`video/*`) and size server-side; the size
   check belongs in the action, not only in the input element.
2. **Portal player** (`/portal/review/[assetId]`). Latest cut only, a short-lived
   signed URL fetched per request — never a stored URL — a timecode scrubber,
   and the comment form calling `portal_add_review_comment`.
3. **Resolution UI** for staff: set `resolved_at`/`resolved_by`, and move the
   asset back to `in_review` when the next version lands.
4. **E2E**: a client commenting on the current cut; a client refused on a
   superseded one; unauthenticated access to a signed URL after expiry.

The Phase 6 portal is the template — owner-run views for reads, one
`SECURITY DEFINER` function for writes, and the client role holding no table
policy at all.

### Totals at this commit

201 unit · 230 database · 81 e2e desktop · axe clean incl. `/portal` ·
typecheck clean · build clean.

### Still approval-gated — see DECISIONS-NEEDED.md

Service-role key rotation; the live self-escalation fix (§11a) — **any signed-in
user can currently make themselves an administrator in production**; worker
scope narrowing (§11b); freelancer losing `clients.notes` (§11c); money
divergence; everything touching production.
