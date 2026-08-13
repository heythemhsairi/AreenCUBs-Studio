-- Areen CUBs collaboration hub: studio/client task split, internal messages,
-- clickable references, and personal reminders.

alter table public.tasks
  add column if not exists work_scope text not null default 'client';

alter table public.tasks
  drop constraint if exists tasks_work_scope_check;
alter table public.tasks
  add constraint tasks_work_scope_check
  check (work_scope in ('client', 'studio'));

alter table public.tasks alter column project_id drop not null;

alter table public.tasks
  drop constraint if exists tasks_scope_project_check;
alter table public.tasks
  add constraint tasks_scope_project_check
  check (
    (work_scope = 'client' and project_id is not null)
    or (work_scope = 'studio' and project_id is null)
  );

create index if not exists tasks_work_scope_idx
  on public.tasks(work_scope, created_at desc);

-- Commercials can participate in Areen-internal tasks only when assigned.
drop policy if exists "tasks_commercial_studio_select" on public.tasks;
create policy "tasks_commercial_studio_select" on public.tasks
  for select using (
    public.auth_role() = 'commercial'
    and work_scope = 'studio'
    and public.assigned_to_task(id)
  );

drop policy if exists "tasks_commercial_studio_update" on public.tasks;
create policy "tasks_commercial_studio_update" on public.tasks
  for update
  using (
    public.auth_role() = 'commercial'
    and work_scope = 'studio'
    and public.assigned_to_task(id)
  )
  with check (
    public.auth_role() = 'commercial'
    and work_scope = 'studio'
    and public.assigned_to_task(id)
  );

create table if not exists public.studio_messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (char_length(btrim(body)) between 1 and 4000),
  task_id       uuid references public.tasks(id) on delete set null,
  section_path  text check (section_path is null or section_path ~ '^/dashboard(?:/|$)'),
  section_label text check (section_label is null or char_length(section_label) <= 80),
  created_at    timestamptz not null default now()
);

create table if not exists public.studio_message_recipients (
  message_id uuid not null references public.studio_messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  read_at    timestamptz,
  primary key (message_id, user_id)
);

create index if not exists studio_messages_sender_created_idx
  on public.studio_messages(sender_id, created_at desc);
create index if not exists studio_message_recipients_user_idx
  on public.studio_message_recipients(user_id, read_at);

create table if not exists public.reminders (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 240),
  remind_at    timestamptz not null,
  link         text check (link is null or link ~ '^/dashboard(?:/|$)'),
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists reminders_owner_due_idx
  on public.reminders(owner_id, remind_at)
  where completed_at is null;

alter table public.studio_messages enable row level security;
alter table public.studio_message_recipients enable row level security;
alter table public.reminders enable row level security;

create or replace function public.is_studio_message_participant(message_uuid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_internal() and (
    exists (
      select 1 from public.studio_messages m
      where m.id = message_uuid and m.sender_id = auth.uid()
    )
    or exists (
      select 1 from public.studio_message_recipients r
      where r.message_id = message_uuid and r.user_id = auth.uid()
    )
  )
$$;

revoke all on function public.is_studio_message_participant(uuid) from public;
grant execute on function public.is_studio_message_participant(uuid) to authenticated;

create or replace function public.is_internal_profile(profile_uuid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_internal() and exists (
    select 1 from public.profiles p
    where p.id = profile_uuid and p.role <> 'client'
  )
$$;

revoke all on function public.is_internal_profile(uuid) from public;
grant execute on function public.is_internal_profile(uuid) to authenticated;

drop policy if exists "studio_messages_participant_select" on public.studio_messages;
create policy "studio_messages_participant_select" on public.studio_messages
  for select using (
    public.is_internal()
    and (
      sender_id = auth.uid()
      or exists (
        select 1 from public.studio_message_recipients r
        where r.message_id = id and r.user_id = auth.uid()
      )
    )
  );

drop policy if exists "studio_messages_sender_insert" on public.studio_messages;
create policy "studio_messages_sender_insert" on public.studio_messages
  for insert with check (public.is_internal() and sender_id = auth.uid());

drop policy if exists "studio_messages_sender_delete" on public.studio_messages;
create policy "studio_messages_sender_delete" on public.studio_messages
  for delete using (public.is_internal() and sender_id = auth.uid());

drop policy if exists "studio_message_recipients_participant_select" on public.studio_message_recipients;
create policy "studio_message_recipients_participant_select" on public.studio_message_recipients
  for select using (public.is_studio_message_participant(message_id));

drop policy if exists "studio_message_recipients_sender_insert" on public.studio_message_recipients;
create policy "studio_message_recipients_sender_insert" on public.studio_message_recipients
  for insert with check (
    public.is_internal()
    and exists (
      select 1 from public.studio_messages m
      where m.id = message_id and m.sender_id = auth.uid()
    )
    and public.is_internal_profile(user_id)
  );

drop policy if exists "studio_message_recipients_own_update" on public.studio_message_recipients;
create policy "studio_message_recipients_own_update" on public.studio_message_recipients
  for update using (public.is_internal() and user_id = auth.uid())
  with check (public.is_internal() and user_id = auth.uid());

drop policy if exists "reminders_owner_all" on public.reminders;
create policy "reminders_owner_all" on public.reminders
  for all using (public.is_internal() and owner_id = auth.uid())
  with check (public.is_internal() and owner_id = auth.uid());

-- A deliberately narrow mention directory. The profiles table contains fields
-- that should not be exposed to every internal role; this view contains only
-- the identity fields required by the composer.
create or replace view public.studio_member_directory
with (security_barrier = true)
as
select id, username, full_name, role, avatar_url, job_title
from public.profiles
where role <> 'client' and public.is_internal();

revoke all on public.studio_member_directory from public, anon;
grant select on public.studio_member_directory to authenticated;

comment on column public.tasks.work_scope is
  'client = linked client delivery; studio = Areen CUBs internal work';
