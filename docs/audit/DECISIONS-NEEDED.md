# Decisions needed

Everything blocked on approval. Nothing here has been executed.

---

## 1. Rotate the production `service_role` key — CRITICAL, unblocked by anything else

A `service_role` key was pasted into a chat transcript. It **bypasses every RLS policy** on live client and financial data. It is still valid.

Full procedure: `docs/STAGING.md` §1. Checklist: `docs/audit/PRODUCTION-DRIFT-DECISION.md`.

The step most often missed: **redeploy Vercel after updating the variable** — environment variables are read at build/boot, so the old key stays live until then. Verify the old key returns `401`.

**Nobody but you can do this.** It needs no Docker, no WSL, and no agent.

---

## 1b. Content OS RLS grants full CRUD to any authenticated identity — HIGH

**New, confirmed against real PostgreSQL on 2026-08-10. Not yet fixed: tightening RLS is a permission change and needs your approval.**

Migration 21 guards all three Content OS tables with:

```sql
USING (auth.role() = 'authenticated')   -- for SELECT *and* FOR ALL
```

Every other table in the schema checks the *application* role — `is_admin()`, `is_worker_or_admin()`, or a `profiles` lookup. Content OS checks only that a JWT exists.

Measured, as a user with **no `profiles` row** (the same identity Phase 1d denies at the front door):

```
orphan app role            = NULL
orphan is_worker_or_admin  = false
orphan CAN READ plans      = 2
orphan INSERTED plans      = 1
orphan UPDATED items       = 3
orphan DELETED items       = 3
```

A truly anonymous caller (`anon`, no claims) **is** correctly denied — which is why Phase 0's unauthenticated probes did not surface this. The boundary is "any authenticated identity", not "anyone".

**Impact.** Anyone holding a valid session — including an auth user created without the profile insert, exactly the manual onboarding gap behind finding #3.21 — can read, alter and delete every client's content plans and items directly through PostgREST, bypassing the UI and the `requireWorkerOrAdmin()` checks entirely.

**Recommended fix** (forward-only migration, not written, not applied):

```sql
alter policy "content_items_read"  on content_items  using (public.is_worker_or_admin());
alter policy "content_items_write" on content_items  using (public.is_worker_or_admin());
-- and the equivalent for client_content_profiles and monthly_content_plans
```

This aligns the database with what the application already enforces, so it should be behaviour-preserving for legitimate use. **Confirm first** whether any flow intentionally lets freelancers read content — if so the read policy needs a narrower rule rather than `is_worker_or_admin()`.

Current behaviour is pinned by tests in `scripts/db/content-os.dbtest.mjs`, so it cannot change silently. Those tests must be inverted as part of the fix.

---

## 2. Read-only production migration history

Needed to confirm or refute the drift prediction from finding #1: migration `0018` cannot parse, so `0018`–`0025` should be absent from production.

Requires: `supabase migration list` against the hosted project, **connection string redacted**, output pasted back. A guarded read-only wrapper is prepared in `scripts/` but is **not executed** and refuses to run without an explicit approval flag.

Until this lands, every statement about production's schema is an inference — a well-supported one, but an inference.

---

## 3. Money divergence — one centime

`docs/audit/MONEY-COMPATIBILITY.md` §4. Adopting `src/lib/money` changes ~0.9% of *future* documents by one centime, always toward the mathematically correct value. Historical documents are never recomputed.

Needs the accountant's sign-off. Until then the module stays disconnected from persistence.

---

## 4. Production repair migration

Cannot be written responsibly until #2 lands. Outcome-by-outcome plans are in `docs/audit/PRODUCTION-DRIFT-DECISION.md`.

**A corrected historical migration must never be assumed to heal production.** Migrations already recorded as applied do not re-run. Repair must be forward-only.

---

## 5. Deployment, Vercel changes, production data

None attempted. Includes deleting, archiving or bulk-changing agency records, and the 1 DT reconciliation on already-settled invoices (finding #5), which touches real financial history and needs a verified backup first.

---

## 6. New roles and permissions

The brief describes commercial / intern / client-portal roles. The database has exactly three: `admin`, `worker`, `freelancer`. Implementing more requires an approved specification — inventing authorization boundaries would be worse than leaving the gap visible.

---

## 7. Paid or contractual services

None accepted. Docker Desktop was installed under its free tier and no licence terms were accepted on anyone's behalf. Docker Engine CE, Noto Sans Arabic (SIL OFL), Vitest and Playwright are all free/open-source.

---

## 8. Remaining hydration (#418) causes on /dashboard and /dashboard/team — MEDIUM/HIGH

Reproduced in a browser on all three viewports (`docs/audit/PHASE-2F-DASHBOARD-QUALITY.md` F-1). One of four causes is fixed; three remain because they change behaviour rather than formatting:

| Location | Code | Why it mismatches |
|---|---|---|
| `overview-client.tsx:960` | `const hour = new Date().getHours()` | Time-of-day greeting: UTC hour ≠ Africa/Tunis hour |
| `overview-client.tsx:160,1274` | `const today = new Date()` | Relative day counts (`45j retard`, `+70j`) differ per side |
| `priorities-section.tsx:42,131` | `const today = new Date()` | Same |

**Recommended fix:** pass the current business date from the server, exactly as Publishing now does (`todayKey` prop), and derive the greeting from that value rather than the client clock.

**Why not done unattended:** it changes what the dashboard displays (the greeting, and which items count as overdue at a boundary), which is dashboard behaviour rather than a formatting defect.

**Note:** this also corrects Phase 0, which claimed `publishing-client.tsx` was the only file using an ambient locale. The grep matched `toLocale*(undefined` and missed the bare no-argument form. A corrected scan found `projects-table.tsx:186`, now fixed.

---

## 9. Automated contrast checking needs axe-core — LOW

The hand-rolled contrast check in `e2e/a11y.spec.ts` produced false positives across three different implementations and is now diagnostic-only. Adding **axe-core** (free, MIT) would give trustworthy results.

Small, free, additive — but it is a new dependency, so it is listed rather than added unilaterally.

---

## 10. Accessibility remediation from axe-core — MEDIUM/HIGH

Confirmed in-browser across desktop, tablet and mobile with no exclusions (`PHASE-2F-DASHBOARD-QUALITY.md` F-6).

**Critical (14 instances):** `select-name` on the inline status selectors (`/dashboard/tasks` ×4, `/dashboard/clients` ×1) and `label` on `/dashboard/settings` (×9). Screen-reader users cannot identify controls that mutate records. Small per instance; spread across several files.

**Serious:** `color-contrast` on every audited route (12–39 nodes each, more on narrow viewports). This is the design-token problem from Phase 0 confirmed in a browser — `--c-text-2`/`--c-text-3` and brand tints against card surfaces. A token-level fix, not per-element patches.

**Why not fixed here:** the labelling fixes touch high-impact financial and task controls, and the contrast fix is a design-system change. Both want review rather than an unattended sweep.

---

## 11. Phase 2 — three items that need a decision before production

> **11a is RESOLVED.** Applied to production by hand on 2026-08-11 and validated.
> See `PRODUCTION-HOTFIX-RECORD.md`. 11b and 11c remain open.

Implemented and verified locally. None has been applied anywhere but the staging
database on this machine.

### 11a. Self-service role escalation is live in production today

`profiles_update_self` (migration 0002) permits a user to update their own
profile row, and `role` is a column of that row. Any signed-in account can run
`update profiles set role = 'admin' where id = auth.uid()` through PostgREST and
become an administrator. No client-side control prevents it, because the write
does not go through the application.

Closed locally by `20260811000005_column_privilege_guards.sql`, a BEFORE UPDATE
trigger. Row Level Security cannot fix this: it decides which rows a statement
may touch, not which columns may change.

**Decision required:** whether to apply this single migration to production
ahead of the rest of Phase 2. It is additive, reversible with one `DROP TRIGGER`,
touches no row, and changes no financial value. It is also the only item in this
programme that closes a live privilege-escalation path.

### 11b. Workers lose blanket client and project access

The roadmap specifies a worker reaches "assigned projects/tasks and the client
information those require; no unrelated client data". Today every worker reads
every client and can read *and write* every project. After Phase 2 a worker
reaches projects they own, are assigned to or created, and the clients those
belong to. Creating new work is unaffected.

This is an operational rule change, not a financial one, and existing worker
workflows that depend on seeing unrelated clients would notice. Recorded here
rather than shipped quietly. See `PERMISSION-MATRIX.md` §4.

### 11c. Freelancers lose the `clients.notes` column

`clients_freelancer_select_via_tasks` returns the whole client row — including
the agency's internal commentary — to anyone holding one assigned task. RLS
cannot withhold a single column, so the policy is dropped and freelancers read
`public.client_directory`, which exposes `id`, `name`, `email` and `phone`.

**Decision required:** confirmation that no freelancer workflow currently
depends on reading a client's internal notes, fiscal number or postal address.

---

## 12. Phase 3 — a note, not a decision

**The `/dashboard/team` "hydration defect" did not exist.** Three sessions
recorded it as React error #418. Reproducing it under a production build showed
the server component itself throwing: `listTeamMembers()` built the Auth admin
client to attach each member's email address, and the constructor raised when
`SUPABASE_SERVICE_ROLE_KEY` was absent — which it deliberately is in the default
end-to-end run.

React's production wording, "An error occurred in the Server Components render",
reads enough like a client-side failure to send a diagnosis down the wrong path,
and the roadmap's Phase 3 plan (component bisection, invalid table nesting,
`localeCompare`, generated IDs) was written against that wrong premise. None of
it applied. Fixed by degrading the email enrichment instead of failing the route.

### Carried into the Phase 10 security review, not urgent

Four admin-only pages — `team/[id]`, `team/planning`, `team/planning/[id]`,
`team/workload` — read `profiles`, `tasks`, `work_schedule` and `time_entries`
through the **service-role** client. An administrator can already read all of
that through RLS, so the elevated client buys nothing and widens the surface on
which a future scoping bug becomes unbounded.

Not changed now: switching them requires confirming an admin SELECT policy on
each of those tables first, and a silent switch that returned empty data would
be a worse regression than the 500 this phase removed.

---

## 13. Emergency hotfix — APPLIED AND VALIDATED

> Resolved. The owner ran it through the Supabase SQL Editor; evidence and the
> rollback are recorded in `PRODUCTION-HOTFIX-RECORD.md`. The section below is
> kept as the record of what was prepared and why `db push` was refused.

Approved as an emergency production security fix. Everything that can be done
without touching production is done. **Nothing has been applied, because this
environment holds no production credentials.**

### What was checked, and what it found

| Check | Result |
|---|---|
| `~/.supabase/access-token` (Windows and WSL) | absent |
| `supabase/.temp/project-ref` — project link | absent |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `DATABASE_URL` | unset |
| `.env.local` | present, but restricted by `CLAUDE.md` and not read |

Even reading `.env.local` would not help. It carries the anon and service-role
keys, and a service-role key authenticates against PostgREST — it cannot execute
`CREATE TRIGGER`. Applying this fix needs the SQL editor or a Postgres
connection string, neither of which exists here.

### `supabase db push` is ruled out — by the constraint, and by the schema

The instruction was: do not use a general migration push if it would execute any
other pending migration. It would execute **twenty-three**: `0018`–`0025`, which
have never applied to production, plus the seven added in Phases 2–7, plus the
alignment migration.

It would also fail. Migration `20260624000018` contains an unqualified
`current_role()`, a syntax error (42601) — the defect that stopped the chain in
the first place. A push would abort partway with production in an unknown state.

**The fix must be applied as a single standalone statement in the Supabase
dashboard SQL editor.**

### What is ready

`docs/audit/HOTFIX-PROFILE-ROLE-ESCALATION.sql` — four sections: read-only
pre-flight, the fix, the rollback, and a validation matrix. Self-contained: it
calls no helper function and references no enum value added after migration
0001, so it is correct whether production sits at `0017` or `0025`.

### Verified against a production-shaped replica

`scripts/verify-hotfix-prodshape.sh` rebuilds the local database with migrations
`0001`–`0017` only — what production has per `PHASE-0-DISCOVERY.md` §3.1.1 —
and runs the whole procedure. Testing on the full local schema would have proved
little: that schema has six roles and every Phase 2 object, none of which
production has.

```
replica stops at 0017 · profiles_update_self restricts no column ·
job_title present · no guard already installed · auth_role() absent, as in production
CONFIRMED  a worker promoted themselves to admin — 1 row changed
self-promotion denied (worker, freelancer) · username denied · job_title denied
full_name still writable · avatar_url still writable
administrator can still manage roles · service-role path unaffected
reads unaffected · role distribution unchanged
rollback removes both objects · the hole returns — the rollback is genuine
ALL CHECKS PASSED
```

The rollback rehearsal matters most: it proves the prepared rollback restores
the exact prior behaviour rather than merely running without error.

### What is needed to execute

One of:

1. **Preferred** — you run the SQL yourself. Open the Supabase dashboard SQL
   editor, run section 1 and keep the output, run section 2, then section 4.
   Roughly five minutes, and no credential ever leaves the dashboard.
2. A Postgres connection string for the production database, supplied through a
   file or environment variable rather than pasted into chat.

Option 1 is better and not only for secrecy: the pre-flight output should be
read by a person before the write, and the service-role key is still unrotated,
so widening its use now is the wrong direction.

### Local convergence

Migration `20260811000008` installs the identical object locally, so local and
production converge on one guard rather than two near-identical twins. 21 tests
in `role-matrix.dbtest.mjs` cover it, including that it calls no helper a
lagging database might be missing, and that it does not test `current_user` —
the mistake that made the first version permit every write it existed to stop.

§11b and §11c remain open and untouched, as instructed.


---

## 14. Production has no migration ledger — blocks all further schema work

`supabase_migrations.schema_migrations` **does not exist in production**, found
by the hotfix pre-flight. Production was never managed by the Supabase CLI.

This is not a decision so much as a finding that changes what is safe:

- `PHASE-0-DISCOVERY.md` §3.1.1 inferred production sits at migration `0017`.
  That inference cannot be confirmed, because there is nothing to confirm it
  against. **Production's schema state is unknown.**
- `supabase db push` is now categorically unusable, not merely constrained. With
  no ledger the CLI treats all thirty-four migrations as unapplied and would try
  to rebuild the schema from zero on top of itself, aborting on the first
  `create type` or `create table` that already exists.

**Decision needed before any Phase 2–7 migration reaches production:** establish
the real schema state by inspecting production's objects, then choose whether to
baseline it into the CLI ledger or keep managing it by reviewed standalone
statements. Detail in `PRODUCTION-HOTFIX-RECORD.md`.
