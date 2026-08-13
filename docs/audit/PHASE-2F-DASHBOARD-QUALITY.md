# Phase 2F — dashboard quality audit

**Method:** Playwright against the isolated WSL stack. Server `TZ=UTC`, browser `Africa/Tunis`, `fr-FR`. Three viewports: desktop 1280×720, tablet 768×1024, mobile 390×844. All data fabricated (`supabase/seed.sql`).

**Every finding below was reproduced in a browser.** Nothing here is inferred from reading code alone. Where a suspected issue turned out to be a defect in my own test, that is stated rather than reported as a product bug.

Baseline run: **122 passed, 15 failed, 4 skipped**.

Final run after fixes: **131 passed, 6 failed, 4 skipped**. The 6 remaining failures are two routes (`/dashboard`, `/dashboard/team`) × three viewports, all caused by the approval-gated hydration issue in F-1. They are left failing deliberately: the test is correctly reporting a real product defect, and skipping it would hide it.

---

## F-1 · React hydration error #418 on three dashboard pages — **HIGH**

| | |
|---|---|
| **Severity** | High |
| **Pages** | `/dashboard`, `/dashboard/projects`, `/dashboard/team` |
| **Reproduction** | Sign in as the synthetic admin; load each route with server `TZ=UTC` and browser `Africa/Tunis`. |
| **Expected** | No console errors. |
| **Actual** | `Minified React error #418; …args[]=text` on all three, on every viewport. |
| **Evidence** | Playwright console capture, 9 failures (3 routes × 3 viewports). |

**Impact.** React discards the server-rendered HTML for the mismatched subtree and re-renders on the client. Users see a flash of changing content, and any state attached to that subtree is lost. It is the same defect class fixed for Publishing in Phase 1b — this proves the fix was **incomplete**.

### Correction to my Phase 0 analysis

Phase 0 stated that `publishing-client.tsx` was *"the only file in the entire codebase"* using an ambient locale. **That was wrong.** The grep used was `toLocale[A-Za-z]*\(undefined` — it matched the explicit `undefined` argument but missed the **bare call with no arguments**, which behaves identically. A corrected scan (`toLocale(Date|Time)?String\(\s*\)`) finds `projects-table.tsx:186`.

The browser found what the grep missed, which is the argument for running it.

### Confirmed causes

| Location | Code | Why it mismatches |
|---|---|---|
| `projects-table.tsx:186` | `new Date(p.end_date).toLocaleDateString()` | No locale → server `en-US`, browser `fr-FR` |
| `overview-client.tsx:960` | `const hour = new Date().getHours()` | Time-of-day greeting: UTC hour ≠ Africa/Tunis hour |
| `overview-client.tsx:160,1274` | `const today = new Date()` | Render-time clock; relative day counts (`45j retard`, `+70j`) computed differently on each side |
| `priorities-section.tsx:42,131` | `const today = new Date()` | Same |

**Fixed in this phase:** `projects-table.tsx` now uses the shared `formatDate()` (locale and timezone pinned). Small and unambiguous.

**Not fixed — see DECISIONS-NEEDED.md:** the `overview-client.tsx` and `priorities-section.tsx` cases. Removing render-time `new Date()` there means passing the current date from the server (as Publishing does) and reworking the hour-based greeting. That touches dashboard behaviour rather than formatting, so it is a change to propose, not to make unattended.

**Verification:** re-run `npm run test:e2e` — `/dashboard/projects` must be clean. `/dashboard` and `/dashboard/team` will remain failing until the remaining causes are approved and fixed.

---

## F-2 · Contrast measurement — **NOT A CONFIRMED FINDING (my test was wrong)**

The first run reported 15 elements below 3:1, several at exactly **1.00:1**. Exactly 1.00:1 means foreground equals background, which is implausible for legible text and was the clue.

**Cause:** my `bgOf()` helper walked ancestors for an opaque `background-color` and defaulted to **white** when it found none. This theme is dark by default and paints `<body>` with the `background` shorthand using radial-gradients, so `background-color` is transparent all the way up — light text was compared against an assumed white page. Every one of those 15 was a false positive.

**Three attempts to make the measurement trustworthy, all unsuccessful:**

1. Default to white when no opaque ancestor background is found → 15 false positives at 1.00:1
2. Fall back to the live `--c-bg` token, return *indeterminate* rather than guessing → same elements still 1.00:1
3. Skip `background-clip: text` / transparent-colour gradient text → same elements still 1.00:1

Something about how these nodes are painted — layered translucent surfaces, gradients, or an inherited colour this walk does not model — is not captured by comparing computed colour against the nearest opaque ancestor background.

**Resolution:** the check is now **diagnostic-only**. It logs candidates and asserts nothing. Reporting "15 contrast failures" as fact when the measurement is demonstrably wrong would be worse than reporting nothing.

**Recommended follow-up:** add **axe-core** (free, MIT) and use its colour-contrast rule, which resolves stacking, opacity and gradients correctly. Hand-rolled luminance walking is the wrong tool here.

**Still independently valid:** the light-theme problem from Phase 0 — `#8FADCE` on `#E8EBEC` is **1.70:1** by direct calculation, which needs no browser at all.

This is recorded rather than quietly deleted, because "15 contrast failures" would otherwise have entered the report as fact.

---

## F-3 · Denial page assertion — **NOT A FINDING (my test was wrong)**

The orphan-account test reported the `/account-unavailable` page body as empty. The accessibility snapshot captured at failure shows the page rendering correctly: heading *"Compte non configuré"*, both explanatory paragraphs, and the sign-out button.

`page.locator("body").innerText()` returned `""` despite visible content. The test now asserts against `<main>` and the `h1` role. No product defect.

---

## F-4 · Fail-closed authentication — **VERIFIED WORKING**

The Phase 1d fix behaves correctly in a browser, on all three viewports:

- An authenticated user with no `profiles` row never reaches `/dashboard`.
- They are routed to `/account-unavailable`, **not** `/login` — confirming the redirect loop the middleware would otherwise cause is avoided.
- Direct navigation to `/dashboard/clients`, `/dashboard/finance` and `/dashboard/content` all redirect to the same denial page.
- The page does not disclose which half of the check failed.
- Sign-out returns to `/login`.

> **This does not resolve the Content OS database vulnerability** (`DECISIONS-NEEDED.md` §1b). The UI denies that identity; PostgREST does not. UI rejection is not a security boundary, and the database tests proving the bypass remain in `scripts/db/content-os.dbtest.mjs`.

---

## F-5 · Verified working (no defect found)

Reproduced across desktop, tablet and mobile:

| Area | Result |
|---|---|
| Unauthenticated redirect to `/login` | ✅ |
| Invalid credentials rejected | ✅ |
| Unknown user rejected | ✅ |
| Admin sign-in | ✅ |
| Role scoping — freelancer redirected away from finance | ✅ |
| **Publishing hydration** — direct load and client navigation | ✅ clean (Phase 1b fix holds) |
| Clients page (historical hydration control) | ✅ clean |
| Content OS hub, plans and publishing render seeded data | ✅ |
| Finance, invoices, quotes render | ✅ |
| No `NaN` or `undefined` in money output | ✅ |
| Unknown record id does not 500 | ✅ |
| Accessible names on login inputs; keyboard operation; visible focus | ✅ |
| Heading order; image alts; `html[lang]`; tab traversal | ✅ |
| Mobile: no horizontal overflow; 44×44 nav tap targets | ✅ |

10 of the 13 audited routes load with **zero** console errors and **zero** failed requests.

---

## Not audited

Producing findings for these without browser evidence would be inventing them:

- Tasks/projects **mutation** flows (create, edit, drag-to-reschedule)
- Team planning attendance grid interactions
- Quote/invoice creation and the PDF print view
- Settings mutations
- Search, filter and sort behaviour
- Loading skeletons under artificial latency
- Performance metrics (Core Web Vitals)

The harness is in place; these need additional specs.

---

## Summary

| ID | Finding | Severity | Status |
|---|---|---|---|
| F-1 | Hydration #418 on 3 dashboard pages | High | 1 of 4 causes fixed; rest need approval |
| F-2 | Contrast measurement | — | Test defect, corrected; re-measurement pending |
| F-3 | Denial page assertion | — | Test defect, corrected |
| F-4 | Fail-closed auth | — | Verified working |
| F-5 | 13-route sweep | — | 10 clean |

---

## F-1 update — hydration remediation (approved phase)

A hydration-safe time source was introduced: `src/lib/time/now.tsx`. The server resolves the instant once in `dashboard/layout.tsx` and passes it to `NowProvider`; `useNow()` / `useToday()` return that value during SSR **and** the first client render, so markup matches. The clock adopts the real client time only after mount, which is an ordinary state update rather than a mismatch.

Behaviour preserved: the greeting is still derived from the **Africa/Tunis** hour (now via `Intl.DateTimeFormat` with an explicit `timeZone`, instead of `getHours()` on an ambient date), and overdue/priority calculations are unchanged apart from being computed from a stable "today".

Converted: `overview-client.tsx` (greeting hour + two `today` computations) and `priorities-section.tsx` (relative deadlines + inline day math).

**Measured result: browser failures fell from 6 to 3.** `/dashboard` is now clean on desktop, tablet and mobile.

### Still open — `/dashboard/team` (3 failures, one per viewport)

Not fixed, and the cause is **not yet identified**. Ruled out by inspection:

- `team/page.tsx` and `list-client.tsx` contain no date rendering at all (`created_at` is typed but never displayed)
- no `new Date()` / `Date.now()` in `avatar.tsx`, `avatar-stack.tsx`, `ui/badge.tsx`
- the shared layout components it renders are the same ones `/dashboard/clients` uses, and that route is clean

Remaining suspect: `notification-bell.tsx`, whose `relativeTime()` uses `Date.now()` — but it is in the topbar on every route, which does not explain why only this one fails.

**Next step:** run the app in dev mode (non-minified React prints the exact mismatched text rather than `#418`). A diagnostic harness exists at the scratchpad stage but was blocked twice by the stack still reporting `health: starting`; it needs the same readiness wait that `run-e2e.sh` now has.

---

## F-6 · axe-core results — contrast IS a real finding after all

`@axe-core/playwright` replaced the hand-rolled contrast walker. Rules: `wcag2a, wcag2aa, wcag21a, wcag21aa`. **No exclusions of any kind.** Serious and critical are treated as failures; minor/moderate are logged.

### Correction to F-2

F-2 concluded that contrast was "not a confirmed finding" because my walker produced impossible 1.00:1 values. That was right about the *numbers* and wrong about the *conclusion*: axe confirms **genuine, widespread contrast violations**. My measurement was broken; the underlying problem was real. Reported here rather than left as a refuted finding.

### Critical — `select-name` / `label`

| Route | Rule | Nodes |
|---|---|---|
| `/dashboard/tasks` | `select-name` — select has no accessible name | 4 |
| `/dashboard/clients` | `select-name` | 1 |
| `/dashboard/settings` | `label` — form elements have no labels | 9 |

**Impact:** a screen-reader user cannot tell what these controls change. On `/dashboard/tasks` and `/dashboard/clients` these are the inline status selectors — the same high-impact controls flagged in audit finding #10 for lacking confirmation. A user who cannot identify the control can still change a task's status with it.

**Recommended fix:** `aria-label` on each `<select>` naming the record it affects, and `<label htmlFor>` on the settings inputs. Small per-instance, 14 instances total, spread across several files.

### Serious — `color-contrast`

| Route | Nodes (desktop) |
|---|---|
| `/dashboard/finance` | 39 |
| `/dashboard/tasks` | 32 |
| `/dashboard/content` | 32 |
| `/dashboard` | 15 |
| `/dashboard/settings` | 16 |
| `/dashboard/clients` | 13 |
| `/dashboard/projects` | 12 |
| `/login` | 1 |

Node counts rise on tablet/mobile (e.g. `/dashboard` 15 → 27), consistent with denser layouts exposing more low-contrast text.

**This is the Phase 0 token problem, confirmed in a browser.** It is a design-system fix — the `--c-text-2` / `--c-text-3` / brand-tint tokens against card surfaces — not a per-element patch, and it is exactly what the Phase 2 design-token work was scoped to address.

### Status

The axe suite **fails** on this baseline. Left failing deliberately: the violations are real and reporting them is the point. Fixing 14 labelling instances plus a token overhaul is a remediation phase of its own, recorded in `DECISIONS-NEEDED.md`.

---

## F-6 update — critical accessible-name violations FIXED

Verified in-browser: every audited route went from **2 violation types to 1**. `select-name` and `label` are gone; only `color-contrast` remains.

| Rule | Before | After |
|---|---|---|
| `select-name` (critical) | tasks ×4, clients ×1 | **0** |
| `label` (critical) | settings ×9 | **0** |
| `color-contrast` (serious) | every route | unchanged — Priority 3 |

The settings fix is worth noting: all nine failures came from **one** `Field` wrapper rendering a bare `<label>` with no `htmlFor` around a control with no `id`. Fixing the wrapper — deriving an id with React's SSR-safe `useId()` and cloning the child to receive it — produced a real `<label htmlFor>` relationship for all nine, rather than nine `aria-label` patches.

**Remaining: `color-contrast` only**, 12–39 nodes per route, more on narrow viewports. This is the design-token work in `DECISIONS-NEEDED.md` §10 and is **not started** — it needs the semantic light/dark token pass, not per-component overrides.
