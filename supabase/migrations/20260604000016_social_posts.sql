-- Areen CUBs Studio — Social Media Post Scheduler
-- Adds social_posts table with platform, scheduling, status, and task link.

-- ===== Enums =====
do $$ begin
  create type social_platform as enum (
    'instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type social_post_status as enum (
    'draft', 'scheduled', 'published', 'cancelled'
  );
exception when duplicate_object then null; end $$;

-- ===== social_posts =====
create table if not exists public.social_posts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null default '',
  platform      social_platform not null,
  status        social_post_status not null default 'draft',
  scheduled_at  timestamptz,
  published_at  timestamptz,
  media_url     text,
  project_id    uuid references public.projects(id) on delete set null,
  task_id       uuid references public.tasks(id) on delete set null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists social_posts_project_idx  on public.social_posts(project_id);
create index if not exists social_posts_task_idx     on public.social_posts(task_id);
create index if not exists social_posts_scheduled_idx on public.social_posts(scheduled_at);
create index if not exists social_posts_status_idx   on public.social_posts(status);

-- auto updated_at
create or replace function public.set_updated_at_social_posts()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_social_posts_updated on public.social_posts;
create trigger trg_social_posts_updated
  before update on public.social_posts
  for each row execute procedure public.set_updated_at_social_posts();

-- ===== RLS =====
alter table public.social_posts enable row level security;

-- Admin: full access
drop policy if exists "social_posts_admin_all" on public.social_posts;
create policy "social_posts_admin_all" on public.social_posts
  for all using (public.is_admin()) with check (public.is_admin());

-- Worker: read all, insert/update own, no delete
drop policy if exists "social_posts_worker_select" on public.social_posts;
create policy "social_posts_worker_select" on public.social_posts
  for select using (public.is_worker_or_admin());

drop policy if exists "social_posts_worker_insert" on public.social_posts;
create policy "social_posts_worker_insert" on public.social_posts
  for insert with check (
    public.is_worker_or_admin() and created_by = auth.uid()
  );

drop policy if exists "social_posts_worker_update" on public.social_posts;
create policy "social_posts_worker_update" on public.social_posts
  for update using (
    public.is_worker_or_admin() and created_by = auth.uid()
  ) with check (
    public.is_worker_or_admin() and created_by = auth.uid()
  );
