-- Areen CUBs Studio — Row-Level Security policies
-- Enforces: admin sees all, worker sees tasks/clients but no money,
-- freelancer sees only own assigned tasks.

-- ===== Helper functions =====
create or replace function public.current_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_worker_or_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role in ('admin','worker') from public.profiles where id = auth.uid()), false)
$$;

-- ===== Enable RLS on all tables =====
alter table public.profiles      enable row level security;
alter table public.clients       enable row level security;
alter table public.projects      enable row level security;
alter table public.tasks         enable row level security;
alter table public.services      enable row level security;
alter table public.devis         enable row level security;
alter table public.devis_items   enable row level security;
alter table public.payments      enable row level security;
alter table public.task_comments enable row level security;

-- ===== Profiles =====
drop policy if exists "profiles_select_self_or_team" on public.profiles;
create policy "profiles_select_self_or_team" on public.profiles
  for select using (
    auth.uid() = id
    or public.is_worker_or_admin()
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ===== Clients =====
-- Admin: full access. Worker: read-only. Freelancer: only clients linked to their assigned tasks.
drop policy if exists "clients_admin_all" on public.clients;
create policy "clients_admin_all" on public.clients
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "clients_worker_select" on public.clients;
create policy "clients_worker_select" on public.clients
  for select using (public.current_role() = 'worker');

drop policy if exists "clients_freelancer_select_via_tasks" on public.clients;
create policy "clients_freelancer_select_via_tasks" on public.clients
  for select using (
    public.current_role() = 'freelancer'
    and exists (
      select 1
      from public.projects p
      join public.tasks t on t.project_id = p.id
      where p.client_id = clients.id and t.assignee_id = auth.uid()
    )
  );

-- ===== Projects =====
drop policy if exists "projects_admin_all" on public.projects;
create policy "projects_admin_all" on public.projects
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "projects_worker_rw" on public.projects;
create policy "projects_worker_rw" on public.projects
  for all using (public.current_role() = 'worker')
  with check (public.current_role() = 'worker');

drop policy if exists "projects_freelancer_select_via_tasks" on public.projects;
create policy "projects_freelancer_select_via_tasks" on public.projects
  for select using (
    public.current_role() = 'freelancer'
    and exists (select 1 from public.tasks t where t.project_id = projects.id and t.assignee_id = auth.uid())
  );

-- ===== Tasks =====
drop policy if exists "tasks_admin_all" on public.tasks;
create policy "tasks_admin_all" on public.tasks
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tasks_worker_rw" on public.tasks;
create policy "tasks_worker_rw" on public.tasks
  for all using (public.current_role() = 'worker')
  with check (public.current_role() = 'worker');

drop policy if exists "tasks_freelancer_select_own" on public.tasks;
create policy "tasks_freelancer_select_own" on public.tasks
  for select using (
    public.current_role() = 'freelancer' and assignee_id = auth.uid()
  );

drop policy if exists "tasks_freelancer_update_own" on public.tasks;
create policy "tasks_freelancer_update_own" on public.tasks
  for update using (
    public.current_role() = 'freelancer' and assignee_id = auth.uid()
  ) with check (
    public.current_role() = 'freelancer' and assignee_id = auth.uid()
  );

-- ===== Services (read-only catalog for everyone logged in; admin manages) =====
drop policy if exists "services_select_all_authenticated" on public.services;
create policy "services_select_all_authenticated" on public.services
  for select using (auth.uid() is not null);

drop policy if exists "services_admin_all" on public.services;
create policy "services_admin_all" on public.services
  for all using (public.is_admin()) with check (public.is_admin());

-- ===== Devis & devis_items (admin only) =====
drop policy if exists "devis_admin_all" on public.devis;
create policy "devis_admin_all" on public.devis
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "devis_items_admin_all" on public.devis_items;
create policy "devis_items_admin_all" on public.devis_items
  for all using (public.is_admin()) with check (public.is_admin());

-- ===== Payments (admin only) =====
drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

-- ===== Task comments =====
drop policy if exists "task_comments_admin_all" on public.task_comments;
create policy "task_comments_admin_all" on public.task_comments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "task_comments_worker_rw" on public.task_comments;
create policy "task_comments_worker_rw" on public.task_comments
  for all using (public.current_role() = 'worker')
  with check (public.current_role() = 'worker');

drop policy if exists "task_comments_freelancer_own_tasks" on public.task_comments;
create policy "task_comments_freelancer_own_tasks" on public.task_comments
  for all using (
    public.current_role() = 'freelancer'
    and exists (select 1 from public.tasks t where t.id = task_comments.task_id and t.assignee_id = auth.uid())
  ) with check (
    public.current_role() = 'freelancer'
    and exists (select 1 from public.tasks t where t.id = task_comments.task_id and t.assignee_id = auth.uid())
  );
