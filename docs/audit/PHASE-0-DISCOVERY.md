# Phase 0 — Safety & Discovery Report

**Repository:** `heythemhsairi/AreenCUBs-Studio` @ `49700c8` (branch `main`, clean tree)
**Audit date:** 2026-08-10
**Status:** Discovery complete. **No code has been modified. No migration has been run. Nothing has been deployed.**

> **Evidence classification used throughout**
> - **CONFIRMED** — reproduced directly from repository source; file and line cited.
> - **ASSUMPTION** — consistent with the reported live symptom and the code, but requires database or live-session access to prove.
> - **MISSING EVIDENCE** — cannot be assessed without access listed in §8.

---

## 1. Architecture map (CONFIRMED from source)

| Layer | Actual implementation | Evidence |
|---|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript 5.7 | `package.json` |
| Styling | Tailwind 3.4 + CSS custom properties | `tailwind.config.ts`, `src/app/globals.css` |
| Font (current) | `Libre_Franklin` via `next/font/google` | `src/app/layout.tsx:2` |
| Database | Supabase Postgres, 25 SQL migrations | `supabase/migrations/` |
| DB access | `@supabase/ssr` — separate browser / server / middleware clients + a service-role admin client | `src/lib/supabase/{client,server,middleware,admin}.ts` |
| Auth | Supabase Auth, username → synthetic email (`USERNAME_EMAIL_DOMAIN`) | `src/lib/utils.ts`, `src/app/login/actions.ts` |
| Route protection | Global `middleware.ts` → session refresh + redirect | `src/middleware.ts` (12 lines) |
| Server-side authz | 3 helpers only: `requireSession`, `requireAdmin`, `requireWorkerOrAdmin` | `src/lib/auth.ts` (61 lines) |
| Mutations | Next.js **server actions** (`"use server"`). **No REST API routes exist.** | 20+ `actions.ts` files under `src/app/dashboard/**` |
| Background jobs | **None.** No cron, queue, or webhook handler exists. | no `route.ts`, no `vercel.json` cron |
| Deployment | Vercel, auto-deploy on `main` | `README.md` |
| Scale | ~37,800 lines TS/TSX across 200 source files | `wc -l` |

**Architectural consequence that shapes every later phase:** because there are no API routes and no background jobs, *all* authorization is enforced in exactly two places — Postgres RLS, and the top of each server action. There is no third surface to secure, which makes the Phase 3 permission model tractable.

### 1.1 The single most important schema fact

`devis` and `factures` are **the same table**, discriminated by a `kind` column. Both quote-lifecycle and invoice-payment columns exist on every row:

```sql
create type devis_status   as enum ('draft','sent','accepted','rejected');
create type payment_status as enum ('unpaid','partial','paid');
```
— `supabase/migrations/20260506000001_initial_schema.sql:25,29`

There is **no constraint linking `kind`, `status` and `payment_status`.** This single omission is the direct cause of audit finding #5 (see §3.5) and must be resolved before the finance UI is redesigned.

### 1.2 Role model as built

```sql
create type user_role as enum ('admin','worker','freelancer');
```
— `20260506000001_initial_schema.sql:9`

**Only three roles exist.** The requested `commercial`, `intern` and `client_portal_user` roles are entirely greenfield. Authorization today is scattered role-name comparison (`session.role !== "admin"`), not capabilities.

**Security finding (new — not in the original audit): `requireSession()` fails open.** Severity **HIGH** — see §3.21.

---

## 2. Migration inventory & production-drift risk

25 migrations, 1,724 lines total. Timeline `20260506` → `20260626`.

**CONFIRMED DEFECT — migrations are not idempotent.** `20260625000021_content_os.sql` uses `CREATE TABLE IF NOT EXISTS` (safe) but then `CREATE POLICY` **without a guard** (lines 112–119). PostgreSQL has no `CREATE POLICY IF NOT EXISTS`. If this migration ever partially applied, **every re-run aborts at the first policy**, leaving the schema half-built and the migration permanently marked as failed. This is the most plausible mechanism behind finding #1.

**MISSING EVIDENCE:** I cannot compare local migration history against production. `supabase migration list` requires database credentials (§8).

---

## 3. Confirmed issue report

Each item follows the required 11-field format. Findings are re-numbered to match your audit.

---

### 3.1 — Content OS cannot save profiles or monthly plans

| Field | Finding |
|---|---|
| **Severity** | High |
| **Page/component** | `/dashboard/content/clients/[clientId]`, `/dashboard/content/plans` |
| **Reproduction** | Requires DB access — see Verification below |
| **Expected** | Profile and monthly plan save successfully |
| **Actual** | PostgREST error referencing `public.client_content_profiles` / `public.monthly_content_plans`; all clients show 0 plans |
| **Likely cause** | **ASSUMPTION — the migration exists in the repo but appears never to have been fully applied.** Production drift **remains an inference** until migration history is checked (§8.2). The non-idempotent `CREATE POLICY` block (§2) means a partial apply cannot self-heal on retry. Secondary candidate: stale PostgREST schema cache. |
| **Recommended fix** | Do **not** author a new schema, and **do not rewrite migration 21** — it may already have been applied somewhere. Once production migration history is available, prepare a **separate, guarded repair migration** using a reviewed `DROP POLICY IF EXISTS` + recreate strategy (or a `pg_policies` existence check), then `NOTIFY pgrst, 'reload schema'`. **Not to be applied anywhere without approval.** |
| **Files** | `supabase/migrations/20260625000021_content_os.sql`, `src/app/dashboard/content/actions.ts` |
| **Verification** | `supabase migration list`; `select to_regclass('public.monthly_content_plans')`; `select * from pg_policies where tablename in (...)` |
| **Evidence** | Repo schema is **complete and correct** — 3 tables, 6 indexes, FKs, timestamps, updated_at triggers, RLS enabled. The bug is in *delivery*, not design. |

**Important correction to the original audit:** the brief instructs "restore the full schema". The schema does not need restoring — it needs *applying*. Writing a replacement migration would be the exact "incomplete emergency schema" the brief warns against.

---

### 3.2 — Publishing hydration error #418 — **ROOT CAUSE CONFIRMED**

| Field | Finding |
|---|---|
| **Severity** | High |
| **Page/component** | `/dashboard/content/publishing` |
| **Reproduction** | Static reproduction complete (below) |
| **Expected** | Page renders identically on server and client |
| **Actual** | React hydration error #418 |
| **Likely cause** | **CONFIRMED.** Two independent causes in one file. |
| **Recommended fix** | Route both formatters through a locale-pinned shared helper; move `today` into `useEffect`/`useState` or pass it from the server. |
| **Files** | `src/app/dashboard/content/publishing/publishing-client.tsx:106,110,738` |
| **Verification** | Hard-reload the route with an empty cache; console must be clean. Add a regression test asserting no `toLocale*(undefined` in `src/`. |

**Evidence — this is decisive.** A repo-wide scan of all 41 `toLocale*` call sites shows **`publishing-client.tsx` is the only file in the entire codebase that passes `undefined` as the locale:**

```
src/app/dashboard/content/publishing/publishing-client.tsx:106
src/app/dashboard/content/publishing/publishing-client.tsx:110
```
*(no other matches repo-wide)*

`toLocaleString(undefined, …)` resolves to the **runtime** locale: `en-US`/UTC in Node on Vercel, `fr-FR`/Africa-Tunis in the user's browser → different text → mismatch. Every other page uses `formatDate()` from `src/lib/format.ts:19`, which pins `"fr-FR"`. **This precisely explains why the Clients page does not reproduce the error while Publishing does** — exactly the differential your audit observed.

Second cause: `publishing-client.tsx:738` — `const today = new Date()` evaluated during client render is time-dependent and will disagree with the server render.

---

### 3.3 — Past scheduled posts remain scheduled

| Field | Finding |
|---|---|
| **Severity** | High |
| **Page/component** | `/dashboard/content/publishing` |
| **Expected** | Overdue scheduled posts are visibly distinguished |
| **Actual** | Four posts dated 25 Jun–2 Jul still read "scheduled" on 10 Aug |
| **Likely cause** | **CONFIRMED — publishing is manual tracking only.** There is no scheduler, cron, queue or webhook anywhere in the repository. `social_post_status` is a fixed enum with no `processing`/`failed`/`overdue`/`cancelled` members, and nothing ever transitions a row on a timer. |
| **Recommended fix** | Keep publishing manual (do not build an automated publisher without approval). Add a **derived** `overdue` presentation state (`scheduled` + `scheduled_at < now()`), and extend the enum with `processing`/`failed`/`cancelled` plus `failure_reason` + audit log. |
| **Files** | `supabase/migrations/20260604000016_social_posts.sql:12-23`, `src/app/dashboard/content/publishing/publishing-client.tsx` |
| **Verification** | Seed a past-dated scheduled post in staging → must render as Overdue with day count. |
| **Approval gate** | Reconciling the four existing historical rows requires management approval. **Never mark published without external evidence.** |

---

### 3.4 — Quote total inconsistency — **RECLASSIFIED**

> **Reclassification (2026-08-10).** The blank quote total is **mathematically correct**. The defect is a **misleading stamp preview**, severity **low/cosmetic**. The genuine high-severity risks in this area are (a) the totals formula duplicated across four locations and (b) binary-float arithmetic on stored money. Those two are tracked below as the real work.

| Field | Finding |
|---|---|
| **Severity** | **Low** for the stamp preview · **High** for formula duplication + float money |
| **Page/component** | `/dashboard/devis/new`, `/dashboard/factures/new` |
| **Expected** | Stamp line reflects what is actually charged |
| **Actual** | Blank quote shows "Fiscal stamp 1.00 DT" while Total TTC is 0.00 DT |
| **Likely cause** | **CONFIRMED, and it is a display bug, not a math bug.** |

**Correction to the audit.** The brief states *"The invoice form includes the stamp in its total, while the quote form does not."* That is **not** what the code does. There is one shared builder for both documents; the math is byte-identical. The observed difference comes from a **default**, not divergent arithmetic:

```ts
// src/app/dashboard/devis/devis-builder.tsx:127-131
const [applyStamp, setApplyStamp] = useState<boolean>(
  props.mode === "edit" ? Number(props.devis.stamp_dt ?? 0) > 0
                        : props.kind === "facture",   // ON for invoices, OFF for quotes
);
```

The "1.00 DT" that appears on a blank quote is a **preview of the stamp's price while the toggle is off**:

```tsx
// devis-builder.tsx:490
{applyStamp ? formatDt(totals.stamp) : formatDt(STAMP_DT)}
```

So the form is arithmetically correct (stamp excluded when toggled off) but *reads* as though 1.00 DT is being charged. That is a genuine, user-facing defect — just a different one.

**The real high-severity defects in this area are two the audit did not name:**

1. **Duplicated totals logic in four places.** The identical formula is written out in `devis-builder.tsx:148-166` (client preview), `devis/actions.ts:109-119` (`computeTotals`, server, authoritative), the print view, and again in SQL in `20260626000003_fix_devis_totals.sql:15-20`. Four copies that must be kept in lockstep by hand.
2. **Binary floating-point money.** Both copies use `+(x).toFixed(2)` on JS `number`. This violates your explicit rule *"Never rely on binary floating-point arithmetic for stored money."*

| **Recommended fix** | Extract one tested `computeDocumentTotals()` into `src/lib/money/`, using integer millimes (DT × 1000) internally. Import it into the builder, the server action, the print view. Replace the SQL formula with a generated column or a `CHECK`. Fix the stamp row to render `—` (or a muted "not applied") when the toggle is off. |
| **Files** | `src/app/dashboard/devis/devis-builder.tsx`, `src/app/dashboard/devis/actions.ts`, `src/app/devis/[id]/print/print-view.tsx`, new `src/lib/money/` |
| **Verification** | Unit tests: subtotal, qty, bonus lines, discount-before-VAT, VAT on/off, stamp on/off, rounding, quote→invoice conversion. Assert PDF total === DB `total_dt`. |

---

### 3.5 — Financial status contradictions — **ROOT CAUSE CONFIRMED**

| Field | Finding |
|---|---|
| **Severity** | High |
| **Page/component** | `/dashboard/finance` |
| **Expected** | One consistent notion of "unpaid" |
| **Actual** | Global unpaid KPI = 0 DT while the client risk table flags the same client 1 DT "risky"; a paid invoice carries a 1 DT balance; draft quotes show payment states |
| **Likely cause** | **CONFIRMED — two different definitions of "unpaid" in `src/lib/finance.ts`.** |

**Evidence — the contradiction is a two-line difference:**

```ts
// Global KPI — filters by the STORED status column, so a manually-'paid'
// invoice is excluded from the unpaid total entirely.
// src/lib/finance.ts:216-218
.eq("kind", "facture")
.in("payment_status", ["unpaid", "partial"])
```

```ts
// Client risk table — recomputes from money, ignoring the status column.
// src/lib/finance.ts:405-407
const unpaid = Math.max(0, invoiced - collected);
```

An invoice manually marked `paid` whose payments do not cover `total_dt` is therefore **0 DT in the global KPI and 1 DT in the client table simultaneously.** That is exactly the reported contradiction.

**Where the 1 DT comes from — ASSUMPTION (high confidence).** Migration `20260626000003_fix_devis_totals.sql` retroactively raised `total_dt` by the 1 DT fiscal stamp on already-settled invoices. The recorded payment still equals the *old* total, so `total_dt − payments = 1.00 DT` while `payment_status` remains `paid`. The heal migration fixed the document total but never reconciled payments or status.

**Draft quotes showing payment state:** `payment_status` defaults to `'unpaid'` on **every** row including `kind='devis'` drafts (§1.1). Quotes have no payment concept but carry the column regardless.

| **Recommended fix** | (a) `payment_status` becomes **derived**, never stored — or is kept as a generated column with a `CHECK`. (b) Add `CHECK (kind = 'facture' OR payment_status IS NULL)`. (c) Define an approved rounding tolerance in one constant. (d) Add `document_status_audit` table. |
| **Approval gate** | The 1 DT reconciliation touches **settled financial records**. Requires explicit management sign-off and a pre-migration backup. |

---

### 3.21 — `requireSession()` fails open — **NEW HIGH-SEVERITY SECURITY FINDING**

| Field | Finding |
|---|---|
| **Severity** | **High (security)** |
| **Page/component** | `src/lib/auth.ts` — the authorization entry point for **every** dashboard route and server action |
| **Reproduction** | Create a Supabase auth user without inserting the matching `profiles` row (exactly the manual flow documented in `README.md` §"Adding teammates later", where the SQL insert is a separate step a human can forget). Sign in. |
| **Expected** | Access denied — an authenticated identity with no provisioned profile is not a valid principal |
| **Actual** | The user is silently granted a synthetic profile with `role: "freelancer"` and reaches the dashboard |
| **Likely cause** | **CONFIRMED** — explicit fallback branch: |

```ts
// src/lib/auth.ts:28-38  — fails OPEN
if (!profile) {
  return {
    id: user.id,
    username: user.email?.split("@")[0] ?? "user",
    role: "freelancer",     // ← unprovisioned identity becomes a real principal
    ...
  };
}
```

**Why this is High, not Medium.** The README's own onboarding procedure is a two-step manual process (create auth user → run SQL insert). Step two being skipped is not a hypothetical. Additionally the role string is never validated against the `user_role` enum, so any unexpected value read from the database is passed through to callers untyped-at-runtime.

| **Recommended fix** | Fail closed: deny, terminate the session, redirect to an explicit "account not provisioned" state. Validate `role` against a known allow-list and deny on anything unrecognised. **Do not auto-create profiles** — that would convert an authentication bug into a privilege-granting one. |
| **Files** | `src/lib/auth.ts` |
| **Verification** | Behaviour-matrix tests: no session · valid admin · valid worker · authenticated-but-no-profile · unknown role value. |
| **Evidence** | Source above. No test previously covered this path — none could, as no test infrastructure existed (§4). |

---

### 3.6–3.20 — Remaining findings

Verified far enough to plan; full write-ups land with their implementing phase.

| # | Finding | Status | Key evidence |
|---|---|---|---|
| 6 | Completed projects contain active tasks | **ASSUMPTION** | `project_status` enum has no closure workflow; no guard found linking task state to project close |
| 7 | Overdue projects have no risk treatment | **CONFIRMED** | `project_status` is a stored manual enum only; no derived-health computation exists anywhere in `src/` |
| 8 | Mobile calendar unusable at 390px | **ASSUMPTION** | `calendar-view.tsx` renders a month grid with no viewport-conditional Agenda variant |
| 9 | Team Planning inaccessible on mobile | **ASSUMPTION** | `planning-client.tsx` renders one desktop timeline grid; no mobile branch |
| 10 | Inline controls lack safeguards | **CONFIRMED** | Status `<select>` elements call server actions directly; no confirm/undo component exists in `src/components/` |
| 11 | Light-theme contrast poor | **CONFIRMED** | `globals.css:50` — light `--c-cyan: #1A9DBF` on `--c-card: #FFFFFF` ≈ **2.9:1**, fails WCAG AA (needs 4.5:1) |
| 12 | Dark secondary text faint | **CONFIRMED** | `globals.css:15` — `--c-text-3: #86A8C2` on `--c-bg: #071B2C` — borderline for small text |
| 13 | Mobile task filters overflow | **ASSUMPTION** | `tasks-toolbar.tsx` is a horizontal chip row with no drawer/bottom-sheet |
| 14 | Finance mobile too dense | **ASSUMPTION** | 8 KPI cards in a 2-col grid; tab strip has no responsive pattern |
| 15 | Misleading KPI labels | **CONFIRMED** | `finance.ts:292` — `collectedMtd > 0 ? … : 0` returns **0**, not `N/A`, when the denominator is zero. Month collision: `finance.ts:488` `month:"short"` fr-FR yields `juin`/`juil.`, visually truncating to `jui`/`jui` |
| 16 | Reports omit breakdowns | **CONFIRMED — causally linked to #1** | `reports/page.tsx` queries **both** `monthly_content_plans` *and* `social_posts`; publishing queries `social_posts` only. Totals come from `social_posts` (21 posts) while breakdowns come from `content_items`, which is empty **because #1 blocks plan creation**. Fixing #1 will partly fix #16. |
| 17 | Content OS empty state repetitive | **CONFIRMED** | `content-hub-client.tsx` has no search or filter control |
| 18 | Service taxonomy inconsistent | **CONFIRMED** | `category` is free-text; `20260506000007_services_unique_name.sql` constrains *name* only, not category case |
| 19 | Mixed languages / date formats | **CONFIRMED** | `mobile-bottom-nav.tsx:117` — hardcoded `label: "Admin Tasks"` bypassing i18n. `format.ts:19` pins `fr-FR` regardless of the FR/EN toggle, so English UI renders French dates |
| 20 | Overview wastes space | **ASSUMPTION** | Requires visual review |

---

## 4. Baseline established

| Check | Result |
|---|---|
| `npm install` | ✅ exit 0 |
| `npm run typecheck` | ✅ **exit 0 — clean** |
| `npm run build` | ✅ **exit 0** — 60 routes compiled; shared JS 102 kB; middleware 88.6 kB |
| Git tree | clean at `49700c8` |
| Test suite | ❌ **none exists** — no test runner, no test files, no CI workflow |

**The absence of any test infrastructure is itself a Phase 1 blocker.** Your brief requires automated tests for finance, RLS and localization. Vitest must be stood up before the finance refactor, so the money rules have a safety net *before* they are touched.

---

## 5. Fonts — located, licensing **not** cleared

Read-only filesystem inspection found both families in two locations (`~/Downloads/Telegram Desktop/` and the per-user Windows font folder):

| Family | Files | Format | Weights |
|---|---|---|---|
| Clear Sans | 8 | `.ttf` | Thin, Light, Regular, Medium, Bold + 3 italics |
| Ping AR + LT | 9 | `.otf` | Hairline, Thin, ExtraLight, Light, Regular, Medium, Bold, Heavy, Black |

**No licence file, EULA or readme ships alongside either family.** Per your rule *"Do not commit fonts unless their license permits project embedding"*, I have **not** copied, converted or committed any font file.

- **Clear Sans** — originally released by Intel under Apache 2.0, which permits embedding. **Needs confirmation** that these specific files are that release.
- **Ping AR + LT** — a commercial foundry Arabic family. Desktop `.otf` files installed for design work **do not** grant web-embedding rights. A separate **webfont licence** is almost certainly required.

> ### ✅ RESOLVED — decision taken 2026-08-10 (Phase 1e)
>
> **Noto Sans Arabic is approved as the free replacement for Ping AR + LT.**
> Management elected **not to purchase a font licence**. Ping AR + LT is
> withdrawn from the design entirely — not deferred, not kept as a swap target.
>
> - Loaded via `next/font/google` as a **variable font** (100–900, no static
>   weight array) with `display: "swap"`, self-hosted at build time so the
>   browser makes no third-party request.
> - Added as the **Arabic fallback** in the global stack, after the Latin face;
>   applied Arabic-first to anything marked `lang="ar"`.
> - **Libre Franklin is unchanged.** Latin rendering is untouched.
> - Licence: **SIL Open Font License** — free, and embeddable without purchase.
> - **No Ping AR file was copied, converted or committed** at any point.
> - Arabic translations and RTL layout are explicitly **out of scope** for this
>   phase; the `lang="ar"` rule sets typography only, no `direction`.
>
> Enforced by tests in `src/lib/fonts.test.ts`, including a guard that no font
> binary of any family is ever committed to the repository.

**Licensing conclusion (recorded 2026-08-10, superseded by the decision above):**

- **Neither family will be copied, converted, or committed** until licensing is documented in writing.
- **Ping AR + LT is explicitly excluded from any copy or WOFF2 conversion step.** Desktop `.otf` files licensed for design work do not convey web-embedding rights, and no EULA accompanies these files.
- **Proposed fallback: Noto Sans Arabic** (SIL Open Font License, unambiguously embeddable, broad weight coverage, strong Arabic shaping). It is *proposed only* — **the substitution will not be finalised without approval.**
- Clear Sans is *probably* the Apache-2.0 Intel release, but "probably" is not a licence. It stays uncommitted pending confirmation.

> ~~**APPROVAL REQUIRED before Phase 2 typography:** either (a) the Ping AR + LT **webfont** licence, or (b) sign-off on Noto Sans Arabic as the shipped Arabic face with Ping AR kept as a drop-in swap.~~
> **Closed 2026-08-10 — option (b) chosen, with Ping AR withdrawn rather than retained as a swap.** No licence purchased. Implemented in Phase 1e.

---

## 6. Design tokens — current vs. target

The current palette is **teal/cyan** (`--c-cyan: #22B8D6`, `--c-brand: #2C6E96`) — it does **not** contain any of the new brand colours. This is a full palette replacement, not a tweak.

Contrast pre-computation against the supplied palette (light bg `#E8EBEC`):

| Colour | On light bg | Verdict |
|---|---|---|
| Primary `#1064D4` | ≈ **5.9:1** | ✅ passes AA for body text |
| Secondary `#3382D6` | ≈ 3.9:1 | ⚠️ large text / UI only |
| Support `#8FADCE` | **1.70:1** (confirmed) | ❌ **fails WCAG AA at every size.** Needs 4.5:1 for body text and 3:1 even for large text / non-text UI. Must **never** carry body text, metadata, or status labels on the light background. |
| Dark bg `#0A336F` | ≈ 11.8:1 | ✅ excellent |

Accessible derived variants will be generated for `--color-support` rather than altering the supplied brand values.

---

## 7. What I have NOT done

Per your non-negotiable rules, and stated explicitly so nothing is assumed:

- ❌ No code modified — repository is byte-identical to `49700c8`
- ❌ No migration written or applied
- ❌ No production or staging database touched
- ❌ No fonts copied, converted or committed
- ❌ No Google Drive access attempted — possession of the URL is not authorization
- ❌ No deployment
- ❌ No credentials read, printed or stored

---

## 8. Access required to proceed

Phase 0 static analysis is complete. **Every remaining item below is blocked on access I do not have.**

| # | Access needed | Unblocks | Notes |
|---|---|---|---|
| 1 | **Staging** Supabase project + `.env.local` values | #1, #3, #5, #16, all RLS work | Please create a *staging* project — do not give me production keys. Paste them into `.env.local` yourself; I never need to see them. |
| 2 | `supabase migration list` output from production | Migration-drift comparison | Can be run by you and pasted — **redact the connection string** |
| 3 | Production DB backup confirmation | Any approved migration | Required by your own rules before Phase 1 |
| 4 | Test logins for each role | Authorization matrix | Staging accounts only |
| 5 | Browser automation (Playwright) approval | Responsive + a11y evidence, before/after screenshots | Not currently installed; needed for the 320/390/768/1280/1440 matrix |
| ~~6~~ | ~~Ping AR + LT webfont licence~~ | ~~Phase 2 typography~~ | ✅ **Closed** — Noto Sans Arabic approved, no licence needed (§5) |
| 7 | Written approval for Drive OAuth spike | Phase 5 | Read-only scope first |

Without #1 I cannot reproduce findings 1, 3, 5 or 16 against real data, and I will not mark them fixed on static analysis alone.

---

## 9. Recommended sequencing

Ordered by dependency, not by severity.

| Phase | Contents | Gate |
|---|---|---|
| **0.5** | Stand up Vitest + CI; add contrast and i18n lint tests | none — safe, additive |
| **1a** | Idempotent re-apply of migration 21 + PostgREST reload → fixes #1, unblocks #16 | staging DB |
| **1b** | Hydration fix #2 + locale-aware formatter → fixes #2, part of #19 | none — pure code |
| **1c** | `src/lib/money/` integer-millimes totals + tests → fixes #4 | none — pure code |
| **1d** | Financial state machine, constraints, audit log → fixes #5, #15 | **approval** for reconciliation |
| **2** | Brand tokens, fonts, contrast, mobile Calendar/Planning, i18n → #8,#9,#11,#12,#13,#14,#19,#20 | font licence |
| **3** | Capability model, 6 roles, RLS + server-action enforcement, role tests | approval |
| **4** | Client portal + Frame.io-style review workflow | approval |
| **5** | Drive spike → OAuth → upload/playback | **explicit** approval |
| **6** | Full QA, a11y audit, migration dry-run, rollback plan, release notes | **production approval** |

**1b and 1c are pure code changes with a clean typecheck baseline and no database dependency — they can start immediately.**

---

## 10. Open risks

1. **Production drift is unmeasured.** Until §8.2 is supplied, the true delta between repo migrations and the live database is unknown. Everything about finding #1 rests on an inference.
2. **Financial reconciliation touches settled records.** The 1 DT discrepancy is small; the precedent is not. Backup + written approval required.
3. **No test safety net exists today.** Refactoring money math without tests first would be reckless — hence Phase 0.5.
4. ~~**Ping AR licensing may block the Arabic tier** and force a fallback family.~~ **Retired 2026-08-10** — Noto Sans Arabic (SIL OFL) adopted, no licence dependency remains. Residual risk is only cosmetic: the Arabic face is no longer the one originally art-directed for, so Arabic typography should be design-reviewed when translations land.
5. **Google Drive may not support secure review playback** at all; the hybrid architecture in your brief is the likely outcome, and it implies paid object storage — which needs separate approval.
