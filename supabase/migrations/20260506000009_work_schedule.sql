-- Areen CUBs Studio — Work schedule (office vs home days)
-- One row per user per day, recording where they worked / will work.
-- Used on the worker overview as a clickable monthly calendar.

do $$ begin
  create type work_location as enum ('office', 'home');
exception when duplicate_object then null; end $$;

create table if not exists public.work_schedule (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  location    work_location not null,
  note        text,
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists work_schedule_user_date_idx
  on public.work_schedule(user_id, date);

alter table public.work_schedule enable row level security;

drop policy if exists "work_schedule_self_read" on public.work_schedule;
create policy "work_schedule_self_read"
  on public.work_schedule for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "work_schedule_self_all" on public.work_schedule;
create policy "work_schedule_self_all"
  on public.work_schedule for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
