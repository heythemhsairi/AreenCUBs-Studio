# Redesign coverage

Honest per-surface status. A route group counts as **done** only when its
desktop / tablet / mobile screenshots were reviewed in **both themes** for
layout, overflow, hierarchy, focus and empty/loading/error states.

Legend — **✅ done** · **◐ token-level only** (colour and type follow the
system; layout untouched) · **⬜ not started**

---

## Phase status

| # | Phase | Status | Commit |
|---|---|---|---|
| — | Token foundation, Manrope, override-table removal | ✅ | `198d9fc` |
| — | Primitives (button, card), touch targets | ✅ | `7c564b1` |
| 1 | Shared shell | ✅ | `6b3f47b` |
| 2 | Data-dense shared components | ✅ | `6b3f47b` |
| 3 | Charts | ✅ | `f8ef8fc` |
| 4 | Role dashboards + core operations | ◐ | `2270f5a` |
| 5 | Finance and document flows | ⬜ | — |
| 6 | Content OS and review | ⬜ | — |
| 7 | Client portal and external states | ⬜ | — |
| 8 | Settings, profile, remaining routes | ⬜ | — |

**The redesign is INCOMPLETE.** Phases 5–8 have not had layout work. They are
not broken — the foundation propagates colour, type, depth and motion to every
route automatically — but their *layouts* are still the originals.

---

## What phases 1–3 actually changed everywhere

These propagate without a route file being touched, which is why every surface
below is at least ◐ rather than ⬜:

- **The rail** is deep navy in both themes and consumes `--ac-rail`, which
  nothing had used. Active items carry two cues (filled pill + left marker) so
  they survive greyscale.
- **The decorative haze is gone** — two blurred cyan/violet blobs behind every
  dashboard page.
- **Tables**: one depth strategy, denser rows, sticky headers, tabular figures
  on `.num` cells.
- **Charts** read tokens at runtime and follow theme changes.
- **One colour vocabulary**: 669 legacy `var(--c-*)` references retired.

---

## Route-by-route

### Shell — ✅
Rail, topbar, mobile bottom nav, page header, content measure and rhythm.
Role-scoped navigation verified: each role sees only its permitted entries.

### Shared components — ✅
Button, card, table, KPI card, badge, empty state, menus. Focus states added to
every menu item (they were relying on hover alone). Safe-area inset on the
mobile bar — without it the last 34px of every tap sat under the iOS home
indicator.

### Role dashboards — ◐
`SectionHeading` replaces 18 styled-`<p>` section labels on the administrator
overview with real `<h2>`s, and the card hover-lift twitch is gone. **Not yet
done:** genuine information-hierarchy rework per role — deciding what a
commercial, an intern or a freelancer should see *first* based on what they can
act on.

### Projects · tasks · clients · services · team · planning · calendar — ◐
Token-level only. Dense tables inherit the new table primitive; **the
intentional table→mobile-card conversion is not implemented per route.**

### Finance, quotes, invoices, builders, print — ◐
Chart colours tokenised (phase 3). Layout, document polish and the print view
untouched. **Any work here must not alter TVA behaviour, totals, millime
compatibility or issued-document immutability.**

### Content OS, publishing, plans, items, reports — ⬜

### Review workspace (list, detail, upload, player, comments) — ⬜

### Client portal, approval flow, portal player — ◐
Inherits tokens. **Not yet simplified relative to the internal dashboards**,
which the brief requires. Boundaries to preserve: no internal notes, no
employee identity, no finance, no diagnostics.

### Login · account-unavailable · 404 · global error · portal error — ⬜

### Settings · profile · search · command palette · notifications — ◐
Command palette and notification menus got focus states with the shell; their
layouts are unchanged.

---

## Screenshot matrix — REPAIRED, GREEN, AND REVIEWED

`e2e/shots.spec.ts`. **21 passed / 0 failed in 11.7 minutes**, 420 screenshots.

Previously: 117 failed / 15 passed in ~80 minutes, never reviewed.

### What was wrong, and what fixed it

The old spec declared a test per (role x route) and signed in inside
`beforeEach` — roughly **174 full authentications per project**. The suite runs
`workers: 1`, so this was never parallel contention; it was 174 sequential
sign-ins, and once the server fell behind, tests failed in the HOOK rather than
on an assertion, which made a cost problem look like a login bug.

Now: **one test per role**, signing in once and walking every route it can
reach. Six sign-ins per project instead of 174.

Three further defects were found while repairing it, each of which had been
silently degrading the evidence:

1. **`fullPage: true` was capturing only the fold.** Every screenshot in the
   first green run came back exactly 1280x720. The shell is `h-screen` with
   `<main className="flex-1 overflow-y-auto">` — the DOCUMENT never scrolls, so
   there was nothing for `fullPage` to extend to. The capture now releases the
   height/overflow constraints on `main` and its ancestors for the duration of
   the shot. Finance went from 720 to 1998px, a task detail from 720 to 2526px.
2. **The `not-found` capture was photographing the login page.** It ran after
   the failed-login capture, so the session was gone and middleware bounced
   `/dashboard/*` to `/login`. The login page has a `main`, so nothing failed
   and a mislabelled file would have been reviewed as if it were the 404.
3. **Pages outside the app shell hung the readiness wait.** Now reported by
   name with their URL, title and first line of text, and still photographed.

### Scope

- **6 roles** over their own reachable routes; admin covers 25 route families
- **detail pages are reached by CLICKING the first row**, not by hard-coded
  UUIDs, so devis -> detail -> edit -> print is walked as a user would and the
  seed stays the single owner of its ids
- **both themes** at every stop · **3 viewports** — 1280x720, 768x1024, 390x844
- login, login error state, 404, `/dashboard` malformed id, `/portal` malformed
  id, account-unavailable

### Contact sheets

`node scripts/contact-sheet.mjs <screens-dir> <out-dir>` builds 60 labelled
grids. Each cell is captioned with its route and TRUE full-page height, because
the thumbnail shows only the top band and a page rendering 9000px tall is
usually the defect you are looking for.

---

## VISUAL FINDINGS — from actually looking at the screenshots

Recorded per route family. **None of these are marked done**; they are the
input to phases 4-8.

### Confirmed working (visual)

- The rail is deep navy in **both** themes on every route.
- `/dashboard/finance` renders fully — KPI grid, 12-month area chart, three
  donuts, unpaid table — confirming the crash fix visually, not just by exit
  code.
- **Print views are correct and unaffected**: `devis-print` and
  `factures-print` render the document with logo, sender/client blocks, line
  table, `TVA (19%)`, `Timbre fiscal`, `Total TTC` and the signature block,
  correctly OUTSIDE the app shell.

### Defects to fix in the remaining phases

| # | Surface | Finding | Phase |
|---|---|---|---|
| 1 | every route | The "Nouveautés disponibles" banner renders ABOVE the page header on every single route, so the first thing on every page is not what the page is. | 4 |
| 2 | `/dashboard` | Alert cards and a decorative gradient panel render BEFORE the "ESPACE ADMIN / Bonsoir..." page header. The header sits mid-page. | 4 |
| 3 | 404 — all three paths | `/dashboard/this-route-does-not-exist`, `/dashboard/clients/<bad-id>` and `/portal/review/<bad-id>` all render **Next's raw unstyled default 404** — black page, tiny "404 This page could not be found.", no brand, no shell, no way back. The portal one does not even get the root layout title. **There is no `not-found.tsx` anywhere in the app.** | 8 |
| 4 | devis/factures builders | The form occupies a narrow left column with a large empty right side at 1280px. Line items and totals could sit side by side. | 5 |
| 5 | `/dashboard/profile` | Single narrow column of cards against a large empty right side. | 8 |
| 6 | `/dashboard/projects/<id>` | Sparse: a small details card plus a mostly-empty task board, using little of the width. | 4 |
| 7 | `admin-tasks`, `audit` | Empty states are a centred icon and one line inside a large bordered box; they do not offer the action that would resolve the emptiness. | 4 |

### Not yet exercised

The `error.tsx` boundaries are still **unphotographed**. Malformed ids produce
`notFound()`, not a thrown error, so they render the 404 above instead. Forcing
a real boundary needs a fault injected at the data layer; no test-only hook was
added to the application to do it.

## RESOLVED — the axe regression, and the diagnosis that was wrong

Fixed in `e486a03`. Recorded in full because the earlier record sent three
sessions after a colour that was never involved.

### What was recorded vs. what was measured

| | recorded | measured |
|---|---|---|
| pair | `#ffffff on #3b8bba = 3.75:1` | `#5a6b7f on #d8e6f7 = 4.31:1` |
| size | 10pt / 13.33px | 7.5pt / 10px |
| count | 14 failures | 10 failures |
| scope | "every route incl. `/login`" | authenticated dashboard routes only |

`/login`, the login error state, `/account-unavailable` and `/portal` were
**green the whole time**. `#3B8BBA` appears nowhere in the failure. The
selector — `.ml-auto.px-1\.5.bg-\[var\(--c-border\)\]` — was on stdout from
the first run; the earlier sessions grepped `error-context.md`, which holds the
spec source, and then reasoned from a colour they had never confirmed.

The lesson worth keeping: *ruling things out* ("not a Tailwind class", "not
`theme.backgroundImage`", "not `brand.DEFAULT`") felt like progress but could
never converge, because the premise was false. One captured stdout line ended
it.

### The actual cause

The legacy `--c-border` used as a **surface**. It sits outside the neutral
ramp, and both its definitions in `globals.css` are keyed on the pre-redesign
`.dark` selector — which no longer exists, since the theme switch is now
`html.light` opting out of a dark base. So `--c-border` resolved to its LIGHT
value, `#D8E6F7`, *underneath the dark theme*, and `text-content-3` over it
measured 4.31:1 against a 4.5:1 requirement.

Fixed at source: every use of that token as a surface now names a semantic role
(`text-content-2` on `bg-surface-3`, 7.9:1), separators use `bg-line`, and the
topbar shortcut hint became a `<kbd>`.

Two further literals surfaced once the first stopped masking them —
`text-[#3D5068]` on the tasks board at **1.87:1** in dark, never reported,
because axe had only ever scanned ONE theme.

### axe now scans both themes

`axe.spec.ts` scans every screen in dark and light and tags each finding with
its theme. A single-theme scan could not distinguish a correct page from one
whose light values were leaking under the dark theme.

**Evidence: 42 passed / 0 failed** — 14 screens × 3 viewports, both themes each
(84 scans), no violation at any impact level, no rule excluded.

---

## RESOLVED — `/dashboard/finance` was crashing

Fixed in `8a324cd`. The route had been down since `f8ef8fc`: the chart
tokenisation left `const chart = useFinanceColors()` at **module scope**, so
importing the client bundle threw "Invalid hook call" and every visit rendered
the error boundary.

It survived typecheck (valid TS), the build (fails at import evaluation), and
the browser suite — the boundary IS the HTTP 200 response, so
`expect(status).toBeLessThan(400)` passed on a dead page. axe reported it only
obliquely, as `scrollable-region-focusable` on the boundary's `<pre>`.

The core-navigation loop now asserts no dashboard route renders the boundary,
verified in both directions.

## Known follow-ups

- ~37 legacy `var(--c-*)` references remain in files phases 1–3 did not touch.
- ~160 hex literals remain, mostly in print views and `progress-ring` /
  `sparkline`.
- 20+ ambient `toLocale*` calls. Date-only strings are safe at UTC+1;
  timestamps are not. Verify any fix **twice** — a time-dependent failure that
  passes once proves nothing.
- `globals.css` still holds legacy `--c-*` definitions and component classes
  that the `--ac-*` roles supersede.
