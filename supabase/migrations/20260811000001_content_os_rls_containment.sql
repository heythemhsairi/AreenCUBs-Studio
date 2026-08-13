-- Areen CUBs Studio — Content OS RLS containment
--
-- ⚠ LOCAL-ONLY UNTIL PRODUCTION MIGRATION HISTORY IS CONFIRMED.
--    Migrations 0018–0025 appear never to have applied in production (0018
--    aborts with a syntax error), so the Content OS tables this migration
--    hardens may not exist there yet. Do NOT apply until
--    docs/audit/PRODUCTION-DRIFT-DECISION.md §1 is resolved.
--
-- ── What this fixes ─────────────────────────────────────────────────────────
-- Migration 20260625000021 guards all three Content OS tables with
--     USING (auth.role() = 'authenticated')
-- for SELECT *and* FOR ALL. That checks only that a JWT exists — not who the
-- caller is. Measured against the local stack, an authenticated identity with
-- NO profiles row could read every client's plans, insert a plan, and update
-- and delete every content item, entirely bypassing the UI's
-- requireWorkerOrAdmin() checks via PostgREST.
--
-- Every other table in the schema checks the APPLICATION role
-- (is_admin / is_worker_or_admin / a profiles lookup). Content OS was the
-- outlier.
--
-- ── Why is_worker_or_admin() and not assignment scoping ─────────────────────
-- Assignment scoping was considered first. It is NOT expressible here without
-- inventing a rule the schema does not have:
--
--   * clients_worker_select already grants workers EVERY client
--     ("current_role() = 'worker'", migration 0002). Restricting Content OS to
--     assigned clients would be a NEW, stricter rule with no counterpart in the
--     approved model, and there is no client↔worker assignment relationship to
--     derive it from — only projects.owner_id and tasks.assignee_id, which
--     describe project and task ownership, not content responsibility.
--   * Freelancers reach clients only through assigned tasks
--     (clients_freelancer_select_via_tasks), and the application does not
--     expose Content OS to freelancers at all (sidebar rolesAllowed:
--     admin, worker; pages call requireWorkerOrAdmin()).
--
-- So this migration aligns the database with the authorization the application
-- already enforces, and no further. It is deliberately labelled INTERIM
-- CONTAINMENT: it closes the bypass without inventing a permission model.
-- A future assignment-scoped model needs an explicit specification and,
-- most likely, a client↔member assignment table — out of scope here.
--
-- ── Resulting access ────────────────────────────────────────────────────────
--   admin              full read/write   (is_worker_or_admin() is true)
--   worker             full read/write   (matches requireWorkerOrAdmin())
--   freelancer         DENIED
--   authenticated w/o profile  DENIED    (is_worker_or_admin() coalesces false)
--   anonymous          DENIED
--
-- Forward-only. Migration 0021 is NOT edited — its policies are dropped and
-- replaced here, so an environment that already applied 0021 converges to the
-- same end state.

begin;

-- ─── client_content_profiles ────────────────────────────────────────────────
drop policy if exists "content_profiles_read"  on public.client_content_profiles;
drop policy if exists "content_profiles_write" on public.client_content_profiles;

create policy "content_profiles_select" on public.client_content_profiles
  for select using (public.is_worker_or_admin());

create policy "content_profiles_insert" on public.client_content_profiles
  for insert with check (public.is_worker_or_admin());

create policy "content_profiles_update" on public.client_content_profiles
  for update using (public.is_worker_or_admin())
  with check (public.is_worker_or_admin());

create policy "content_profiles_delete" on public.client_content_profiles
  for delete using (public.is_worker_or_admin());

-- ─── monthly_content_plans ──────────────────────────────────────────────────
drop policy if exists "content_plans_read"  on public.monthly_content_plans;
drop policy if exists "content_plans_write" on public.monthly_content_plans;

create policy "content_plans_select" on public.monthly_content_plans
  for select using (public.is_worker_or_admin());

create policy "content_plans_insert" on public.monthly_content_plans
  for insert with check (public.is_worker_or_admin());

create policy "content_plans_update" on public.monthly_content_plans
  for update using (public.is_worker_or_admin())
  with check (public.is_worker_or_admin());

create policy "content_plans_delete" on public.monthly_content_plans
  for delete using (public.is_worker_or_admin());

-- ─── content_items ──────────────────────────────────────────────────────────
-- Nested access: an item is reachable only when its parent plan is. The
-- EXISTS clause makes the containment hold even if a future policy loosens
-- plan visibility — an item can never be more visible than its plan.
drop policy if exists "content_items_read"  on public.content_items;
drop policy if exists "content_items_write" on public.content_items;

create policy "content_items_select" on public.content_items
  for select using (
    public.is_worker_or_admin()
    and exists (
      select 1 from public.monthly_content_plans p
      where p.id = content_items.plan_id
    )
  );

create policy "content_items_insert" on public.content_items
  for insert with check (
    public.is_worker_or_admin()
    and exists (
      select 1 from public.monthly_content_plans p
      where p.id = content_items.plan_id
    )
  );

create policy "content_items_update" on public.content_items
  for update using (
    public.is_worker_or_admin()
    and exists (
      select 1 from public.monthly_content_plans p
      where p.id = content_items.plan_id
    )
  )
  with check (
    public.is_worker_or_admin()
    and exists (
      select 1 from public.monthly_content_plans p
      where p.id = content_items.plan_id
    )
  );

create policy "content_items_delete" on public.content_items
  for delete using (public.is_worker_or_admin());

-- RLS must remain enabled; a policy set is meaningless without it.
alter table public.client_content_profiles enable row level security;
alter table public.monthly_content_plans   enable row level security;
alter table public.content_items           enable row level security;

commit;
