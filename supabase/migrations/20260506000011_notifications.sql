-- Areen CUBs Studio — In-app notifications
-- One row per "thing that happened" addressed to a specific user.
-- Inserts come from server actions through the service-role admin client
-- (so we bypass RLS for inserts; SELECT/UPDATE are restricted to the
-- owning user).

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,
  body        text not null,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_own_select" on public.notifications;
create policy "notifications_own_select"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications_own_update" on public.notifications;
create policy "notifications_own_update"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications_own_delete" on public.notifications;
create policy "notifications_own_delete"
  on public.notifications for delete
  using (auth.uid() = user_id);
