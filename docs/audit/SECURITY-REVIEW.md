# Security and performance review — Phase 10

A written pass over the boundaries this programme built or changed, what
enforces each one, where it is tested, and what remains open. Evidence over
assertion: every claim below names the test file or migration that proves it.

## 1. Authentication and authorization

**Two independent layers, neither trusted alone.** Server guards
(`src/lib/auth.ts`) decide who may call; Row Level Security decides which rows
the call may touch. A hidden UI control is never a permission.

- Guards are **allow-lists**. `requireWorkerOrAdmin` was once
  `if (role === "freelancer") deny` — a deny-list that silently admits every
  role invented after it. All guards now enumerate what they accept; a role
  nobody has thought about reaches nothing.
- **Fail closed**: no session → `/login`; session without a profile row →
  `/account-unavailable`; unrecognised role → denied, never downgraded.
  Tested in `src/lib/auth.test.ts`.
- The `client` role is external: `/dashboard` requires `is_internal`, the
  portal requires `client`, and neither redirect can loop into the other.
  Tested in `e2e/roles.spec.ts`.

## 2. Row Level Security

- The six-role matrix is specified in `PERMISSION-MATRIX.md`, implemented in
  migrations `20260811000002–5`, asserted by
  `scripts/db/role-matrix.dbtest.mjs` (~130 assertions). Reads assert
  **counts**, writes assert **rows affected** — never merely whether SQL threw,
  because RLS denies writes by filtering and a zero-row update reports success.
- **No policy in `public` grants access to "any authenticated caller"** —
  asserted as a live query against `pg_policies`, so a future migration that
  reintroduces one fails the suite.
- Column containment uses **owner-run views with explicit REVOKE**
  (`client_directory`, `portal_*`), because RLS cannot withhold a column. The
  REVOKE matters: a single-table view is auto-updatable and Supabase grants
  ALL to `authenticated` by default — `client_directory` was writable until a
  test tried it.
- Column-level privileges RLS cannot express are triggers:
  `guard_profile_self_update` (role/username/job_title/id — **applied to
  production** as the emergency hotfix), `guard_task_scope_change`,
  `guard_issued_devis`. Lesson recorded in each: inside `SECURITY DEFINER`,
  `current_user` is the owner — callers are identified by `auth.uid()` only.

## 3. Direct object references

Every portal surface answers **"not found"** identically for a missing id and
another organisation's id — content approval, review comments, review assets,
storage. Probed in `role-matrix.dbtest.mjs` (14 id-probe assertions) and
`e2e/review.spec.ts` (404 indistinguishability in the browser).

## 4. Storage

- Both buckets private. `task-files`: internal roles only. `review-media`:
  staff write; clients read **only under their own organisation's path
  prefix**, parsed from the object name — and the path is built from database
  values only, nothing user-controlled, not even the filename.
- All media access is **signed URLs, created per request, minutes-long**.
  Nothing durable is stored or rendered; revoking membership revokes the file.
- Upload validation is server-side (mime, size); the `accept` attribute is
  treated as a convenience, and a text file POSTed as video is refused —
  tested in the browser.

## 5. Secrets

- The service-role key appears in no client bundle, no `NEXT_PUBLIC_*`
  variable, and the default e2e run **operates without it entirely** — a suite
  that needs the most privileged credential to pass will one day leak it.
- Elevated reads degrade (`createAdminClientOrNull`); elevated writes fail
  loudly. A missing key costs a display column, never an open door.
- The Drive adapter keeps OAuth material in server env only; access tokens in
  process memory; failed token exchanges reported by status code because an
  OAuth error body can echo parameters into a log. Real account not connected;
  approval-gated.
- Secret scans run at every phase close. **Still open: the production
  service-role key exposed early in this engagement remains unrotated** —
  `DECISIONS-NEEDED.md` §1, the oldest open item.

## 6. Financial integrity

- One calculation source (`document-calc.ts`) for preview, server and stored
  totals. Issued documents freeze at the database (`guard_issued_devis`);
  `calc_source` names the engine per row, making "never recompute historical
  documents" auditable. The millimes engine is compared in shadow and its
  output discarded; divergences logged as structure, never amounts.
- A commercial cannot issue, settle, delete, or touch another book's drafts —
  each a separate rows-affected assertion.

## 7. Audit trail

Append-only by construction (no UPDATE/DELETE policy — asserted against
`pg_policies`), attributed via `auth.uid()`, and now **read** on
`/dashboard/audit`, because a record nobody reads is a table, not a trail.
Entries record titles and structure, never document contents or credentials.

## 8. Known gaps, in priority order

1. **Service-role key rotation** — exposed, unrotated, owner action (§1).
2. **Production schema state unknown** — no migration ledger exists; every
   production change must remain hand-applied and self-contained (§14).
3. Four admin pages read through the service-role client where RLS would do
   (`team/[id]`, `team/planning{,/[id]}`, `team/workload`) — widening surface,
   not a leak; switch after confirming admin SELECT policies.
4. `updates_read`/`update_items_read` gate on `is_internal()` — banners are
   agency-visible; acceptable, noted for completeness.
5. Rate limiting is Supabase's default; no application-level throttle on the
   portal write functions. Low risk (authenticated, validated, audit-logged)
   but worth revisiting if client accounts multiply.

## 9. Performance

- Every column an RLS predicate filters on is indexed
  (`client_members_*`, `clients_created_by/owner`, `projects_client/owner`,
  `tasks_created_by`, review and audit indexes) — asserted in the matrix suite
  so a dropped index fails a test, not a page.
- Scope predicates are `STABLE SECURITY DEFINER` SQL functions: plannable,
  and their inner queries bypass RLS, so policies do not recurse.
- The dashboard and reports pages issue parallel queries via `Promise.all`
  and every query is wrapped so one failure degrades a section, not the page.
- Heaviest known path: `worker_linked_to_client()` walks projects→tasks→
  assignees per candidate row. Fine at agency scale (tens of clients);
  revisit with a materialised membership table if client count reaches
  thousands.
