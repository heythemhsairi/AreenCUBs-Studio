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

## Screenshot matrix

`e2e/shots.spec.ts` replaces the old 12-screen set (`screenshots.spec.ts`,
now deleted — both matched the same `-g "design evidence"` filter and ran
simultaneously, competing for one dev server):

- **6 roles** across their own reachable routes (admin 17, commercial 4,
  worker 3, intern 2, freelancer 2, client 1)
- **both themes** per shot
- **3 viewports** — 1280×720, 768×1024, 390×844
- plus unauthenticated states (login, 404, account-unavailable)

The old matrix only ever photographed the administrator in the default theme —
exactly the blind spot a redesign creates, since the light theme and four roles
were being changed with nobody looking at them.

### The new matrix DOES NOT WORK YET — 117 failed / 15 passed, 1.3 hours

Measured, not assumed. Two full runs finished with the same shape: most tests
failing in `beforeEach` on `page.fill` against `/login`, after a runtime of
about eighty minutes.

The filter collision with the old spec was real but was **not** the main cause.
The design of `shots.spec.ts` is: roughly 174 tests (6 roles × their routes ×
3 viewports), each performing its **own full sign-in**, then two full-page
screenshots with a 600 ms settle. That is ~174 logins against one dev server,
and once it saturates, the login form stops rendering inside the timeout and
every subsequent test fails the hook rather than the assertion — which is why
the failures look like a login bug rather than a load problem.

**The fix is to stop logging in per test.** Either:

- capture one Playwright `storageState` per role once, and have each test reuse
  it (`test.use({ storageState })`), or
- collapse each role into a SINGLE test that signs in once and walks its routes
  in a loop, taking both themes at each stop.

The second is simpler here and cuts the run to six logins. Either way, re-run
and **review the images** before marking any route ✅ — the point of the matrix
is human inspection, and no one has inspected these.

---

## OPEN DEFECT — axe is RED, and it is a regression from this work

**14 axe failures**, one repeated colour pair on every route including `/login`
and `/account-unavailable`:

```
#ffffff on #3b8bba = 3.75:1  (10pt / 13.33px)
```

`#3B8BBA` is the **pre-token brand colour**. axe passed 14/14 at `198d9fc`, so
this was introduced by phases 1–4 (`7c564b1`, `6b3f47b`, `f8ef8fc`, `2270f5a`)
— most likely uncovered rather than created, since deleting the override tables
stopped a patch from repainting it.

### What has been ruled out, with evidence

- **Not a Tailwind class.** `grep` over the built CSS in `.next/static/css`
  finds no rule emitting `3b8bba`.
- **Not `theme.backgroundImage`.** The `brand-gradient` literal did run to
  `#3B8BBA` and was tokenised — the failure count and the reported pair are
  **unchanged**, so that was not the source.
- **Not `brand.DEFAULT`.** It resolves to `rgb(var(--ac-accent))`.
- Remaining source literals are in `tasks/tags` (a colour picker, legitimately
  literal data), `charts/palette.ts`, `print-view.tsx` and `error.tsx` — none of
  which render on `/login`.

### The next diagnostic, exactly

The axe spec prints the failing node's selector to **stdout**, not into
`error-context.md` (that file contains the spec source, which is why grepping
it returned the template string). Capture it:

```bash
bash scripts/run-e2e.sh --project=desktop -g "login page has no serious" 2>&1   | grep -A6 "\[axe\]"
```

The `e.g. [...]` line names the element. Since it renders on `/login`, which
has no shell, look at the root layout, `LanguageToggle`, `ThemeToggle` and the
`Toaster` — and at any **inline `style`**, since the colour is not in the CSS.

**Do not add a route to the done column until axe is green again.**

## Known follow-ups

- ~37 legacy `var(--c-*)` references remain in files phases 1–3 did not touch.
- ~160 hex literals remain, mostly in print views and `progress-ring` /
  `sparkline`.
- 20+ ambient `toLocale*` calls. Date-only strings are safe at UTC+1;
  timestamps are not. Verify any fix **twice** — a time-dependent failure that
  passes once proves nothing.
- `globals.css` still holds legacy `--c-*` definitions and component classes
  that the `--ac-*` roles supersede.
