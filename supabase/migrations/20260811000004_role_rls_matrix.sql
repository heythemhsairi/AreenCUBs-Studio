-- Phase 2 (3 of 3) — the complete RLS matrix for six roles.
--
-- Implements docs/audit/PERMISSION-MATRIX.md. Read that document first; this
-- file is its mechanical translation and the tests in
-- scripts/db/role-matrix.dbtest.mjs assert the same table.
--
-- ── The problem this migration exists to solve ──────────────────────────────
-- Twelve policies across seven migrations grant access to "any authenticated
-- user": `auth.uid() is not null` or `auth.role() = 'authenticated'`. While
-- every account belonged to the agency that was loose but survivable. The
-- moment a `client` role exists, each one becomes a leak of internal data to
-- someone outside the company — assignment metadata, task history, the price
-- catalog, agency settings.
--
-- So this is not only an additive migration. It CONTAINS the existing surface.
-- Every one of those twelve is narrowed to public.is_internal() or tighter.
--
-- ── Forward-only ────────────────────────────────────────────────────────────
-- No applied migration is edited. Policies are dropped and recreated here, so
-- an environment that already applied 0002-0025 converges to the same end
-- state as one replaying the chain from empty. Policies are not data; no row
-- is deleted and no column is dropped.
--
-- ── Recursion ───────────────────────────────────────────────────────────────
-- The scope predicates from migration 2 are SECURITY DEFINER and owned by a
-- superuser, so the queries inside them bypass RLS. That is what allows the
-- tasks policy to call assigned_to_project(), which itself reads tasks,
-- without the policy re-entering itself.

begin;

-- ═══ 1. New tables ═════════════════════════════════════════════════════════

alter table public.client_members enable row level security;
alter table public.audit_log      enable row level security;

-- client_members — the grant table. Whoever can write here can widen access,
-- so writes are admin-only except for a commercial assigning a client they
-- already own to themselves, which cannot widen anything.
drop policy if exists "client_members_admin_all" on public.client_members;
create policy "client_members_admin_all" on public.client_members
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "client_members_commercial_select" on public.client_members;
create policy "client_members_commercial_select" on public.client_members
  for select using (
    public.is_commercial() and public.commercial_owns_client(client_id)
  );

drop policy if exists "client_members_staff_select" on public.client_members;
create policy "client_members_staff_select" on public.client_members
  for select using (
    public.is_staff() and public.worker_linked_to_client(client_id)
  );

-- The caller may always see the row that names them. A client contact needs
-- this to resolve which organisation they belong to.
drop policy if exists "client_members_select_own" on public.client_members;
create policy "client_members_select_own" on public.client_members
  for select using (profile_id = auth.uid());

-- audit_log — append-only. SELECT and INSERT policies exist; UPDATE and DELETE
-- have none, so no one reaching this table through RLS can revise history.
drop policy if exists "audit_log_admin_select" on public.audit_log;
create policy "audit_log_admin_select" on public.audit_log
  for select using (public.is_admin());

drop policy if exists "audit_log_select_own" on public.audit_log;
create policy "audit_log_select_own" on public.audit_log
  for select using (public.is_internal() and actor_id = auth.uid());

drop policy if exists "audit_log_insert_self" on public.audit_log;
create policy "audit_log_insert_self" on public.audit_log
  for insert with check (public.is_internal() and actor_id = auth.uid());

-- ═══ 2. Profiles ═══════════════════════════════════════════════════════════
-- Self always. The internal directory for staff and commercial. A client
-- reaches their own row and nothing else — no worker identities, ever.
drop policy if exists "profiles_select_self_or_team" on public.profiles;
create policy "profiles_select_self_or_team" on public.profiles
  for select using (
    auth.uid() = id
    or public.is_staff()
    or public.is_commercial()
  );

-- ═══ 3. Clients ════════════════════════════════════════════════════════════
-- Blanket worker access is replaced by assignment scope. See
-- PERMISSION-MATRIX.md §4 — this is a deliberate, documented behaviour change.
drop policy if exists "clients_worker_select" on public.clients;
create policy "clients_worker_scoped_select" on public.clients
  for select using (
    public.auth_role() = 'worker' and public.worker_linked_to_client(id)
  );

drop policy if exists "clients_worker_insert" on public.clients;
create policy "clients_worker_insert" on public.clients
  for insert with check (
    public.auth_role() = 'worker' and created_by = auth.uid()
  );

drop policy if exists "clients_worker_update" on public.clients;
create policy "clients_worker_update" on public.clients
  for update
  using (public.auth_role() = 'worker' and public.worker_linked_to_client(id))
  with check (public.auth_role() = 'worker' and public.worker_linked_to_client(id));

-- Freelancers no longer read the clients table at all. The old policy returned
-- the whole row including `notes`, the internal commentary about a client.
-- They read public.client_directory instead, which has no such column.
drop policy if exists "clients_freelancer_select_via_tasks" on public.clients;

-- Commercial: their own clients only, and they may create and edit them.
-- No delete policy — deletion stays with the administrator.
drop policy if exists "clients_commercial_select" on public.clients;
create policy "clients_commercial_select" on public.clients
  for select using (
    public.is_commercial() and public.commercial_owns_client(id)
  );

drop policy if exists "clients_commercial_insert" on public.clients;
create policy "clients_commercial_insert" on public.clients
  for insert with check (
    public.is_commercial() and created_by = auth.uid()
  );

drop policy if exists "clients_commercial_update" on public.clients;
create policy "clients_commercial_update" on public.clients
  for update
  using (public.is_commercial() and public.commercial_owns_client(id))
  with check (public.is_commercial() and public.commercial_owns_client(id));

-- ═══ 4. Projects ═══════════════════════════════════════════════════════════
-- Was: every worker had read AND write on every project.
drop policy if exists "projects_worker_rw" on public.projects;

drop policy if exists "projects_worker_scoped_select" on public.projects;
create policy "projects_worker_scoped_select" on public.projects
  for select using (
    public.auth_role() = 'worker'
    and (public.assigned_to_project(id) or public.worker_linked_to_client(client_id))
  );

drop policy if exists "projects_worker_insert" on public.projects;
create policy "projects_worker_insert" on public.projects
  for insert with check (public.auth_role() = 'worker');

drop policy if exists "projects_worker_update" on public.projects;
create policy "projects_worker_update" on public.projects
  for update
  using (public.auth_role() = 'worker' and public.assigned_to_project(id))
  with check (public.auth_role() = 'worker' and public.assigned_to_project(id));

-- Intern: read-only, assignment scoped.
drop policy if exists "projects_intern_select" on public.projects;
create policy "projects_intern_select" on public.projects
  for select using (
    public.auth_role() = 'intern' and public.assigned_to_project(id)
  );

-- Commercial: read-only visibility of work happening for their own clients.
drop policy if exists "projects_commercial_select" on public.projects;
create policy "projects_commercial_select" on public.projects
  for select using (
    public.is_commercial() and public.commercial_owns_client(client_id)
  );

-- Freelancer: unchanged in spirit, restated through the shared predicate.
drop policy if exists "projects_freelancer_select_via_tasks" on public.projects;
create policy "projects_freelancer_select_via_tasks" on public.projects
  for select using (
    public.auth_role() = 'freelancer' and public.assigned_to_project(id)
  );

-- ═══ 5. Tasks ══════════════════════════════════════════════════════════════
drop policy if exists "tasks_worker_rw" on public.tasks;

drop policy if exists "tasks_worker_scoped_select" on public.tasks;
create policy "tasks_worker_scoped_select" on public.tasks
  for select using (
    public.auth_role() = 'worker'
    and (created_by = auth.uid()
         or public.assigned_to_task(id)
         or public.assigned_to_project(project_id))
  );

drop policy if exists "tasks_worker_insert" on public.tasks;
create policy "tasks_worker_insert" on public.tasks
  for insert with check (public.auth_role() = 'worker');

drop policy if exists "tasks_worker_update" on public.tasks;
create policy "tasks_worker_update" on public.tasks
  for update
  using (
    public.auth_role() = 'worker'
    and (created_by = auth.uid()
         or public.assigned_to_task(id)
         or public.assigned_to_project(project_id))
  )
  with check (public.auth_role() = 'worker');

-- Intern: assigned tasks, read and progress updates. The WITH CHECK repeats
-- assigned_to_task so an intern cannot reassign a task away from themselves,
-- which would otherwise be a legal update that quietly loses them the row.
drop policy if exists "tasks_intern_select" on public.tasks;
create policy "tasks_intern_select" on public.tasks
  for select using (
    public.auth_role() = 'intern' and public.assigned_to_task(id)
  );

drop policy if exists "tasks_intern_update" on public.tasks;
create policy "tasks_intern_update" on public.tasks
  for update
  using (public.auth_role() = 'intern' and public.assigned_to_task(id))
  with check (public.auth_role() = 'intern' and public.assigned_to_task(id));

-- Freelancer: restated through the shared predicate so the multi-assignee
-- table counts. The original policy only checked tasks.assignee_id, so a
-- freelancer added as a secondary assignee could not see their own task.
drop policy if exists "tasks_freelancer_select_own" on public.tasks;
create policy "tasks_freelancer_select_own" on public.tasks
  for select using (
    public.auth_role() = 'freelancer' and public.assigned_to_task(id)
  );

drop policy if exists "tasks_freelancer_update_own" on public.tasks;
create policy "tasks_freelancer_update_own" on public.tasks
  for update
  using (public.auth_role() = 'freelancer' and public.assigned_to_task(id))
  with check (public.auth_role() = 'freelancer' and public.assigned_to_task(id));

-- ═══ 6. Task collaboration ═════════════════════════════════════════════════

drop policy if exists "task_comments_worker_rw" on public.task_comments;
create policy "task_comments_worker_rw" on public.task_comments
  for all
  using (
    public.auth_role() = 'worker'
    and exists (select 1 from public.tasks t
                where t.id = task_comments.task_id
                  and (t.created_by = auth.uid()
                       or public.assigned_to_task(t.id)
                       or public.assigned_to_project(t.project_id)))
  )
  with check (public.auth_role() = 'worker');

drop policy if exists "task_comments_intern_rw" on public.task_comments;
create policy "task_comments_intern_rw" on public.task_comments
  for all
  using (public.auth_role() = 'intern' and public.assigned_to_task(task_id))
  with check (public.auth_role() = 'intern' and public.assigned_to_task(task_id));

drop policy if exists "task_comments_freelancer_own_tasks" on public.task_comments;
create policy "task_comments_freelancer_own_tasks" on public.task_comments
  for all
  using (public.auth_role() = 'freelancer' and public.assigned_to_task(task_id))
  with check (public.auth_role() = 'freelancer' and public.assigned_to_task(task_id));

-- Assignment metadata. Was readable by ANY authenticated user, which would
-- have handed a portal client the agency's staffing map.
drop policy if exists "task_assignees_select" on public.task_assignees;
create policy "task_assignees_select" on public.task_assignees
  for select using (
    public.is_staff()
    or user_id = auth.uid()
    or (public.is_internal() and public.assigned_to_task(task_id))
  );

drop policy if exists "project_assignees_select" on public.project_assignees;
create policy "project_assignees_select" on public.project_assignees
  for select using (
    public.is_staff()
    or user_id = auth.uid()
    or (public.is_internal() and public.assigned_to_project(project_id))
  );

-- Task history. Was any authenticated user; now internal, and scoped to tasks
-- the caller can actually reach.
drop policy if exists "task_activity_read" on public.task_activity;
create policy "task_activity_read" on public.task_activity
  for select using (
    public.is_staff() or (public.is_internal() and public.assigned_to_task(task_id))
  );

drop policy if exists "task_templates_read_all" on public.task_templates;
create policy "task_templates_read_all" on public.task_templates
  for select using (public.is_internal());

drop policy if exists "tag_catalog_select" on public.task_tag_catalog;
create policy "tag_catalog_select" on public.task_tag_catalog
  for select using (public.is_internal());

-- ═══ 7. Finance ════════════════════════════════════════════════════════════
--
-- The commercial draft rule, stated exactly because it is the sharpest
-- restriction in the matrix:
--
--   INSERT — allowed only with status = 'draft', only for an owned client.
--   UPDATE — the USING clause requires the row to BE a draft; the WITH CHECK
--            requires it to REMAIN one. Both halves are needed. USING alone
--            would let a commercial promote their draft to 'sent'; WITH CHECK
--            alone would let them edit an already-issued document down.
--   DELETE — no policy exists, so it is denied.
--
-- payment_status is pinned to 'unpaid' alongside status, and that is not
-- belt-and-braces. Constraining `status` alone left `payment_status` free, so
-- a commercial could mark their own draft PAID — settling an invoice, the
-- single most consequential financial action in the application, from the role
-- explicitly forbidden to do it. The role-matrix suite caught it by asserting
-- rows affected; the policy had no opinion on the column at all.
--
-- Payments, expenses and status transitions stay with the administrator.

drop policy if exists "devis_commercial_select" on public.devis;
create policy "devis_commercial_select" on public.devis
  for select using (
    public.is_commercial() and public.commercial_owns_client(client_id)
  );

drop policy if exists "devis_commercial_insert_draft" on public.devis;
create policy "devis_commercial_insert_draft" on public.devis
  for insert with check (
    public.is_commercial()
    and public.commercial_owns_client(client_id)
    and status = 'draft'
    and payment_status = 'unpaid'
  );

drop policy if exists "devis_commercial_update_draft" on public.devis;
create policy "devis_commercial_update_draft" on public.devis
  for update
  using (
    public.is_commercial()
    and public.commercial_owns_client(client_id)
    and status = 'draft'
    and payment_status = 'unpaid'
  )
  with check (
    public.is_commercial()
    and public.commercial_owns_client(client_id)
    and status = 'draft'
    and payment_status = 'unpaid'
  );

-- Line items follow their parent document. Delete is permitted here and only
-- here: removing a line from an unissued draft is editing that draft, not
-- deleting a business record.
drop policy if exists "devis_items_commercial_draft" on public.devis_items;
create policy "devis_items_commercial_draft" on public.devis_items
  for all
  using (
    public.is_commercial()
    and exists (select 1 from public.devis d
                where d.id = devis_items.devis_id
                  and d.status = 'draft'
                  and public.commercial_owns_client(d.client_id))
  )
  with check (
    public.is_commercial()
    and exists (select 1 from public.devis d
                where d.id = devis_items.devis_id
                  and d.status = 'draft'
                  and public.commercial_owns_client(d.client_id))
  );

-- Price catalog: agency commercial data. Interns and freelancers have no
-- finance access of any kind, and a client must never see internal pricing.
drop policy if exists "services_select_all_authenticated" on public.services;
create policy "services_select_internal" on public.services
  for select using (public.auth_role() in ('admin','worker','commercial'));

-- Expenses were already admin-write / staff-read. Restated so the read side
-- names the roles explicitly rather than inheriting is_worker_or_admin().
drop policy if exists "worker_read_expenses" on public.expenses;
create policy "worker_read_expenses" on public.expenses
  for select using (public.is_staff());

-- ═══ 8. Content OS ═════════════════════════════════════════════════════════
--
-- Migration 20260811000001 contained these to is_worker_or_admin() and closed
-- its note with: "A future assignment-scoped model needs an explicit
-- specification and, most likely, a client↔member assignment table — out of
-- scope here." Migration 2 of this phase added exactly that table, so the
-- deferred scoping can now be expressed. Staff access is unchanged; these are
-- additional read-only surfaces for two roles that previously had none.

drop policy if exists "content_profiles_commercial_select" on public.client_content_profiles;
create policy "content_profiles_commercial_select" on public.client_content_profiles
  for select using (public.is_commercial() and public.commercial_owns_client(client_id));

drop policy if exists "content_plans_commercial_select" on public.monthly_content_plans;
create policy "content_plans_commercial_select" on public.monthly_content_plans
  for select using (public.is_commercial() and public.commercial_owns_client(client_id));

drop policy if exists "content_items_commercial_select" on public.content_items;
create policy "content_items_commercial_select" on public.content_items
  for select using (public.is_commercial() and public.commercial_owns_client(client_id));

drop policy if exists "content_profiles_intern_select" on public.client_content_profiles;
create policy "content_profiles_intern_select" on public.client_content_profiles
  for select using (public.auth_role() = 'intern' and public.assigned_to_client(client_id));

drop policy if exists "content_plans_intern_select" on public.monthly_content_plans;
create policy "content_plans_intern_select" on public.monthly_content_plans
  for select using (public.auth_role() = 'intern' and public.assigned_to_client(client_id));

drop policy if exists "content_items_intern_select" on public.content_items;
create policy "content_items_intern_select" on public.content_items
  for select using (public.auth_role() = 'intern' and public.assigned_to_client(client_id));

-- ═══ 9. Agency-wide operational data ═══════════════════════════════════════
-- Not client data, but not for clients either. Narrowed from "any
-- authenticated user" to internal staff.

drop policy if exists "settings_read_all" on public.settings;
create policy "settings_read_all" on public.settings
  for select using (public.is_internal());

drop policy if exists "featured_employees_read_all" on public.featured_employees;
create policy "featured_employees_read_all" on public.featured_employees
  for select using (public.is_internal());

drop policy if exists "updates_read" on public.app_updates;
create policy "updates_read" on public.app_updates
  for select using (public.is_internal() and active = true);

drop policy if exists "update_items_read" on public.app_update_items;
create policy "update_items_read" on public.app_update_items
  for select using (public.is_internal());

-- ═══ 10. Task file storage ═════════════════════════════════════════════════
-- Attachments to internal tasks. A client must not reach the bucket; Phase 7
-- adds a separate, client-scoped review-media surface rather than widening
-- this one.
drop policy if exists "task_files_storage_select" on storage.objects;
create policy "task_files_storage_select" on storage.objects
  for select using (bucket_id = 'task-files' and public.is_internal());

drop policy if exists "task_files_storage_insert" on storage.objects;
create policy "task_files_storage_insert" on storage.objects
  for insert with check (bucket_id = 'task-files' and public.is_internal());

drop policy if exists "task_files_storage_delete" on storage.objects;
create policy "task_files_storage_delete" on storage.objects
  for delete using (bucket_id = 'task-files' and public.is_internal());

commit;
