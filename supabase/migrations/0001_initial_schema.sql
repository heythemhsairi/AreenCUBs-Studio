-- Areen CUBs Studio — Initial schema
-- Run in Supabase SQL editor (or supabase db push) on a fresh project.

-- ===== Extensions =====
create extension if not exists "pgcrypto";

-- ===== Enums =====
do $$ begin
  create type user_role as enum ('admin', 'worker', 'freelancer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('active', 'on_hold', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'review', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type devis_status as enum ('draft', 'sent', 'accepted', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('unpaid', 'partial', 'paid');
exception when duplicate_object then null; end $$;

-- ===== Profiles (linked 1:1 to auth.users) =====
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  full_name    text,
  role         user_role not null default 'freelancer',
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ===== Clients =====
create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  address           text,
  matricule_fiscal  text,
  email             text,
  phone             text,
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ===== Projects =====
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  name        text not null,
  description text,
  status      project_status not null default 'active',
  owner_id    uuid references public.profiles(id) on delete set null,
  start_date  date,
  end_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ===== Tasks =====
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null,
  description  text,
  status       task_status not null default 'todo',
  priority     task_priority not null default 'normal',
  assignee_id  uuid references public.profiles(id) on delete set null,
  created_by   uuid references public.profiles(id) on delete set null,
  deadline     date,
  deliverable_url text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists tasks_assignee_idx on public.tasks(assignee_id);
create index if not exists tasks_project_idx on public.tasks(project_id);

-- ===== Services catalog =====
create table if not exists public.services (
  id                 uuid primary key default gen_random_uuid(),
  name_fr            text not null,
  name_en            text,
  description_fr     text,
  category           text,
  default_price_dt   numeric(10,2) not null default 0,
  default_unit       text not null default 'unit',
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ===== Devis (quotes) =====
-- devis_number is auto-managed via sequence -> formatted as #EST 000 0037 etc.
create sequence if not exists public.devis_number_seq start with 37;

create table if not exists public.devis (
  id              uuid primary key default gen_random_uuid(),
  devis_number    integer not null unique default nextval('public.devis_number_seq'),
  client_id       uuid not null references public.clients(id) on delete restrict,
  date            date not null default current_date,
  due_date        date not null default (current_date + interval '14 days'),
  object          text,
  status          devis_status not null default 'draft',
  payment_status  payment_status not null default 'unpaid',
  subtotal_dt     numeric(10,2) not null default 0,
  tva_rate        numeric(5,2) not null default 19.00,
  tva_dt          numeric(10,2) not null default 0,
  total_dt        numeric(10,2) not null default 0,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists devis_client_idx on public.devis(client_id);
create index if not exists devis_status_idx on public.devis(status);

create table if not exists public.devis_items (
  id           uuid primary key default gen_random_uuid(),
  devis_id     uuid not null references public.devis(id) on delete cascade,
  service_id   uuid references public.services(id) on delete set null,
  description  text not null,
  quantity     numeric(10,2) not null default 1,
  unit_price_dt numeric(10,2) not null default 0,
  line_total_dt numeric(10,2) not null default 0,
  position     integer not null default 0,
  is_bonus     boolean not null default false
);
create index if not exists devis_items_devis_idx on public.devis_items(devis_id);

-- ===== Payments =====
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  devis_id    uuid not null references public.devis(id) on delete cascade,
  amount_dt   numeric(10,2) not null,
  paid_at     date not null default current_date,
  method      text,
  notes       text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists payments_devis_idx on public.payments(devis_id);

-- ===== Task comments =====
create table if not exists public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists task_comments_task_idx on public.task_comments(task_id);

-- ===== updated_at trigger =====
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_clients_updated on public.clients;
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated on public.projects;
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_devis_updated on public.devis;
create trigger trg_devis_updated before update on public.devis
  for each row execute function public.set_updated_at();
