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

## Continuation point — Phase 1 COMPLETE

### Phase 1 — contrast and semantic design tokens: DONE

**Axe: 30 passed, 0 failed, zero violations of any rule**, across desktop 1280×720, tablet 768×1024 and mobile 390×844, rules `wcag2a wcag2aa wcag21a wcag21aa`, **no exclusions**. Session start was 9 failing / 1 passing on desktop alone.

Everything was corrected in the light-theme override block in `globals.css`. Components were not restyled except where an element had no accessible name, so hierarchy, badge shape and brand identity are unchanged.

Colours corrected (all axe-measured): muted text, accent, six badge tones, three Tailwind hex tints, six Tailwind *named* status colours at 300/400 weights, `text-ink/40`–`/70` blends, rose-at-opacity, and per-theme brand text.

Brand text is now theme-aware from the approved palette: **light `#1064D4`** (primary, 5.53:1), **dark `#8FADCE`** (supporting, 6.09:1). `#8FADCE` is unusable as light-mode body text at 1.70:1 on `#E8EBEC` and excellent on dark — the palette used where each colour works.

### Chart palettes: no change needed

The final contrast failure looked like it required theme-aware chart palettes. It did not. `#34d399` on `#ceedec` was `text-emerald-400` on `bg-emerald-500/15` — **legend/label text, never a chart mark**. Status identity lives in the tint, which is untouched; only the label took a readable tone. `PIE_PALETTE`, donut swatches and all series colours are exactly as before.

If a future failure genuinely involves a chart *mark*, that is when theme-aware palettes become necessary — `src/components/charts/palette.ts` is the natural home.

### Screenshot matrix: captured

`e2e/screenshots.spec.ts` writes 27 full-page captures (9 screens × 3 viewports) to `e2e/.artifacts/screens/`, which is gitignored — evidence for review, not repository content. All show synthetic seed data.

```bash
cd ~/AreenCUBs-Studio-staging
npx playwright test screenshots
```

Reviewed by eye: hierarchy, typography, spacing and brand identity intact. The dashboard greeting renders the correct Africa/Tunis hour, confirming the hydration-safe time source. Finance shows `N/A` for a zero-denominator margin, which is the behaviour audit finding #15 asked for.

### Two traps worth remembering

1. **A theme override is only safe on surfaces that belong to that theme.** Light-mode corrections landed on the mobile navigation, which is `bg-[#0D2D47]/95` in *both* themes, giving 2.05:1 across nine nodes. It is `md:hidden`, so desktop runs could never show it. Persistently-dark containers are now marked `data-surface="dark"` and the light corrections are scoped around them. Mark any new such surface the same way.
2. **A green suite can mean nothing ran.** One run reported "zero violations" only because the build had failed on a transient `next/font` fetch. Always confirm the pass count and a successful build, not just the absence of violations.

### Next: Phase 2 — role schema and complete RLS matrix

Per the roadmap. **Write the permission matrix document first** — administrator, worker, freelancer, commercial, intern, client — then the forward-only migration adding roles and membership/assignment relationships, then RLS tests per role asserting rows visible *and* rows affected. Everything from Phase 3 onward depends on it.

### Totals

200 unit · 103 database · 30 axe · typecheck clean · build clean, 52 routes.
