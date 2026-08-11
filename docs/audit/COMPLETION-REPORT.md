# Completion report — Areen CUBs Studio implementation programme

Branch `phase-1-data-integrity`, final HEAD at this report. Every claim below
is backed by a committed test, a migration, or a named document in this
repository; nothing is estimated.

**Final gate run (Phase 11), all green:**

| Gate | Result |
|---|---|
| Migration chain from empty | 34 migrations + synthetic seed |
| Typecheck / production build | clean / clean |
| Unit tests | **241 passed** (10 files) |
| Database & RLS tests | **260 passed**, 8 intentionally skipped (5 files) |
| Browser tests, 3 viewports | **287 passed** — desktop 1280×720, tablet 768×1024, mobile 390×844 |
| Accessibility (axe, WCAG 2.1 AA) | 14 screens, **zero serious or critical violations**, no exclusions |
| Design evidence | 36 screenshots — 12 screens × 3 viewports, fabricated data |
| Hygiene | no service-role key in the default e2e run; no production hostname in test traffic; secret scan clean; stack stopped (0 containers, 0 listeners); tree clean |

---

## 1. Completed and verified

### Security and roles
- **Six-role model** — administrator, worker, freelancer, commercial, intern,
  client — specified first (`PERMISSION-MATRIX.md`), then implemented as four
  forward-only migrations and asserted by ~150 database tests that measure
  **rows visible and rows affected**, never merely whether SQL threw.
- **Explicit membership** (`client_members`): access is never inferred from an
  email domain or a name. Fail closed everywhere — a session without a profile,
  or with a role no policy names, reaches nothing.
- **Twelve "any authenticated user" policies contained.** Each would have
  leaked internal data to client accounts; a live `pg_policies` assertion keeps
  them from returning.
- **Column containment** where RLS structurally cannot reach: reduced views
  with explicit `REVOKE` (`client_directory`, `portal_*`) and column-guard
  triggers (profile role/username/job title/id; task assignment; issued-document
  financial columns).
- **Production hotfix, applied and validated by the owner**: the self-service
  administrator escalation (`profiles_update_self` + writable `role` column)
  is closed in production by `trg_profiles_role_guard`. Role totals unchanged
  before/after. Record: `PRODUCTION-HOTFIX-RECORD.md`.

### Surfaces
- **Commercial dashboard** — personal book, drafts, follow-ups, pipeline; the
  agency-wide finance queries are never issued for the session. Draft-only
  authoring: cannot issue, settle, delete, or leave draft status (enforced in
  policy, re-checked in actions, frozen by trigger once issued).
- **Intern dashboard** — assigned tasks and their context only; reads clients
  through the reduced directory, never the table that carries internal notes.
- **Client portal** — organisation-scoped content, approval/revision workflow
  with mandatory revision comments, notifications to the internal owner, audit
  entries; work-in-progress statuses invisible; identical "not found" for
  missing and foreign ids so ids cannot be probed.
- **Video review** — assets, immutable versions, timecoded comments,
  resolution workflow, staff workspace, portal player with per-request signed
  URLs on a private path-scoped bucket; upload validated server-side; tested
  end-to-end including a real upload with no service-role key in play.
- **Optional TVA** — per-document toggle and rate, one calculation source for
  preview/server/stored totals, fiscal stamp separate, issued documents frozen
  at the database with an explicit audit-visible escape hatch, `calc_source`
  stamped per row.
- **Agency brief and audit surface** — daily/weekly reporting with every
  section labelled confirmed/derived/missing; workload weighted by priority and
  overdue state, never volume alone; append-only audit trail now readable.
- **Design system and accessibility** — WCAG AA across both themes, three
  viewports, zero serious/critical axe violations, no exclusions.

### Defects found and fixed on the way
- Any signed-in user could make themselves administrator (production — fixed
  there); its guard test could not fail (measured after rollback — rewritten).
- A commercial could mark their own draft paid (policy pinned `status` only).
- `client_directory` and the portal views were writable (auto-updatable views
  + default grants — revoked, and now asserted).
- `SECURITY DEFINER` guards silently passing everyone (`current_user` = owner —
  rewritten on `auth.uid()`).
- `/dashboard/team` "hydration defect" was a server-render throw: the Auth
  admin client constructor raised without a service-role key, costing the whole
  route for one display column. Reads now degrade; writes still fail loudly.
- The totals math existed twice (server + preview) — unified into one source.

## 2. Locally implemented, production approval-gated

Ready, tested, and **not** applied to production:

1. **All 34 schema migrations beyond production's state** — the six-role RLS
   matrix, membership, portal surfaces, video review, optional TVA, audit log,
   shadow log. Production has only the pre-existing schema plus the hotfix.
2. **The millimes money engine** — implemented, shadow-compared on every draft
   calculation, its output discarded; divergences logged as structure only.
   Persisted totals remain legacy arithmetic until the documented one-centime
   divergence is approved.
3. **Google Drive adapter** — complete behind `STORAGE_PROVIDER=gdrive`; real
   account not connected; runbook in `docs/GOOGLE-DRIVE-SETUP.md`.
4. **Worker scope narrowing (§11b) and freelancer notes removal (§11c)** —
   live in the local schema, explicitly held for a separate decision before
   production.

## 3. Unresolved blockers

1. **Production has no migration ledger** (`supabase_migrations.schema_migrations`
   does not exist). Production's schema state is *unknown* — the Phase 0
   "stops at 0017" conclusion was an inference with nothing to confirm it
   against. `supabase db push` is categorically unusable: it would attempt all
   34 migrations against a schema that already has most objects and abort
   partway. **This blocks every production schema rollout until resolved** —
   see the rollout plan.
2. **Clear Sans licence** — not embedded, no licence evidence; Libre Franklin
   remains the Latin face until the owner provides it.

## 4. Required management actions

| # | Action | Why now |
|---|---|---|
| 1 | **Rotate the exposed service-role key** (Supabase dashboard → API settings → regenerate; update Vercel env) | Exposed at the start of this engagement; oldest open item; nothing local depends on it |
| 2 | Decide §11b / §11c (worker and freelancer scope) | They ship with the Phase 2 migration; workflows change |
| 3 | Approve or defer the millimes engine | The shadow log now measures the divergence live |
| 4 | Decide the production schema strategy (rollout plan step 1) | Blocks everything in category 2 |
| 5 | Provide Clear Sans licence evidence, or keep Libre Franklin | Typography closure |
| 6 | When wanted: connect Google Drive per the runbook | Separate approval, ~20 min |

## 5. Production rollout plan — exact

The pattern is the one that already worked once (the hotfix): self-contained
statements, rehearsed on a production-shaped replica, applied by hand with a
prepared rollback, validated by rows-affected probes. **No `db push` at any
step.**

**Step 0 — prerequisites.** Rotate the service-role key (action 1). Fresh
production database backup (Supabase dashboard → Database → Backups).

**Step 1 — establish the real schema.** From the SQL editor, dump the object
inventory (tables, columns, policies, functions, triggers, enum values) and
diff against the local schema per migration level. This replaces inference
with fact. *(Read-only; prepared script can be generated on request.)*

**Step 2 — baseline the ledger.** Create `supabase_migrations.schema_migrations`
and insert one row per migration Step 1 proves present
(`supabase migration repair --status applied` writes only the ledger). From
here the CLI's view of production is truthful.

**Step 3 — decide §11b/§11c** (they are inside the Phase 2 migration; if
declined, a small compatibility migration restores the old worker/freelancer
read scope on top — prepared on request).

**Step 4 — apply the outstanding migrations in order, one at a time**, in a
maintenance window, via the SQL editor: first the historical `0018–0025`
(with the known `0018` syntax fix), then `20260811000002 → 000009`. After
each: run its section of the role-matrix probes (rows visible / rows affected
as an impersonated user). Each file is transactional; a failure rolls back
that file only, and stops the sequence.

**Step 5 — seed nothing.** Production keeps its real data; the synthetic seed
is local-only by design.

**Step 6 — deploy the application** (Vercel) only after Step 4 completes —
the app at this HEAD assumes the six-role schema. Validate: sign in per role,
run the §4 validation matrix from the hotfix file pattern, check `/dashboard`,
`/portal`, finance totals unchanged (they are not touched by any migration —
`calc_source` backfills as a marker only).

**Step 7 — after stability**: consider the millimes engine (action 3) with the
shadow log as evidence, and Drive (action 6).

Rollback at any step: each migration file's inverse is mechanical (drop the
named objects; none rewrites data); the application deploy reverts via Vercel;
the backup from Step 0 is the last resort.

---

*Verification for every feature: `CLAUDE.md` (local commands),
`SECURITY-REVIEW.md` (boundary-by-boundary evidence),
`PERMISSION-MATRIX.md` (the specification the tests walk).*
