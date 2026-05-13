-- Areen CUBs Studio — Phase 12: productivity batch
-- 1) time_entries  — start/stop timers per task
-- 2) task_activity — audit trail per task
-- 3) task_templates — saved task definitions
-- 4) priority_pins  — per-user "today's priorities" (max 3 enforced in app)

-- ===== 1. time_entries =====
create table if not exists public.time_entries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  task_id           uuid not null references public.tasks(id) on delete cascade,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  duration_seconds  integer,
  note              text,
  created_at        timestamptz not null default now()
);
create index if not exists time_entries_user_idx on public.time_entries(user_id, started_at desc);
create index if not exists time_entries_task_idx on public.time_entries(task_id);
-- Only one running timer per user
create unique index if not exists time_entries_one_running_per_user
  on public.time_entries(user_id) where ended_at is null;

alter table public.time_entries enable row level security;

drop policy if exists "time_entries_admin_all" on public.time_entries;
create policy "time_entries_admin_all"
  on public.time_entries for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "time_entries_self_all" on public.time_entries;
create policy "time_entries_self_all"
  on public.time_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== 2. task_activity =====
create table if not exists public.task_activity (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists task_activity_task_idx on public.task_activity(task_id, created_at desc);

alter table public.task_activity enable row level security;

drop policy if exists "task_activity_read" on public.task_activity;
create policy "task_activity_read"
  on public.task_activity for select
  using (auth.uid() is not null);

-- Inserts come from server actions through the admin client, so no
-- insert/update/delete policy needed (admin role bypasses RLS).

-- ===== 3. task_templates =====
create table if not exists public.task_templates (
  id                            uuid primary key default gen_random_uuid(),
  name                          text not null,
  title                         text not null,
  description                   text,
  priority                      task_priority not null default 'normal',
  default_deadline_offset_days  integer,
  created_by                    uuid references public.profiles(id) on delete set null,
  created_at                    timestamptz not null default now()
);

alter table public.task_templates enable row level security;

drop policy if exists "task_templates_read_all" on public.task_templates;
create policy "task_templates_read_all"
  on public.task_templates for select
  using (auth.uid() is not null);

drop policy if exists "task_templates_admin_write" on public.task_templates;
create policy "task_templates_admin_write"
  on public.task_templates for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "task_templates_worker_write" on public.task_templates;
create policy "task_templates_worker_write"
  on public.task_templates for all
  using (public.current_role() = 'worker')
  with check (public.current_role() = 'worker');

-- ===== 4. priority_pins (today's focus list, per user) =====
create table if not exists public.priority_pins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  task_id     uuid not null references public.tasks(id) on delete cascade,
  pinned_at   timestamptz not null default now(),
  unique (user_id, task_id)
);
create index if not exists priority_pins_user_idx on public.priority_pins(user_id, pinned_at desc);

alter table public.priority_pins enable row level security;

drop policy if exists "priority_pins_self_all" on public.priority_pins;
create policy "priority_pins_self_all"
  on public.priority_pins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
