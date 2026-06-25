-- Admin Tasks: internal management tasks visible only to admins.
-- These are completely separate from public.tasks (worker/project tasks).

create table if not exists public.admin_tasks (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  status              text not null default 'todo'
                        check (status in ('todo','in_progress','waiting','done','cancelled')),
  priority            text not null default 'normal'
                        check (priority in ('low','normal','high','urgent')),
  due_date            date,
  assigned_admin_id   uuid references public.profiles(id) on delete set null,
  related_client_id   uuid references public.clients(id) on delete set null,
  related_project_id  uuid references public.projects(id) on delete set null,
  related_devis_id    uuid references public.devis(id) on delete set null,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists admin_tasks_status_idx    on public.admin_tasks(status);
create index if not exists admin_tasks_due_date_idx  on public.admin_tasks(due_date);
create index if not exists admin_tasks_assigned_idx  on public.admin_tasks(assigned_admin_id);

-- updated_at trigger (reuse pattern from tasks table)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists admin_tasks_updated_at on public.admin_tasks;
create trigger admin_tasks_updated_at
  before update on public.admin_tasks
  for each row execute function public.set_updated_at();

-- RLS: only profiles whose role = 'admin' can touch this table.
alter table public.admin_tasks enable row level security;

drop policy if exists "Admins can read admin_tasks"  on public.admin_tasks;
drop policy if exists "Admins can insert admin_tasks" on public.admin_tasks;
drop policy if exists "Admins can update admin_tasks" on public.admin_tasks;
drop policy if exists "Admins can delete admin_tasks" on public.admin_tasks;

create policy "Admins can read admin_tasks"
  on public.admin_tasks for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can insert admin_tasks"
  on public.admin_tasks for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update admin_tasks"
  on public.admin_tasks for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete admin_tasks"
  on public.admin_tasks for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
