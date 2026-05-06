-- Areen CUBs Studio — Phase 4 schema additions
-- 1) Avatar URL on profiles
-- 2) Factures (invoices) as a typed devis
-- 3) Featured employee of the month
-- 4) Public 'avatars' storage bucket + policies

-- ===== 1. avatar_url on profiles =====
alter table public.profiles
  add column if not exists avatar_url text;

-- ===== 2. devis kind (devis vs facture) =====
do $$ begin
  create type devis_kind as enum ('devis', 'facture');
exception when duplicate_object then null; end $$;

alter table public.devis
  add column if not exists kind devis_kind not null default 'devis';

-- Separate sequence for facture numbering, starting at 1
create sequence if not exists public.facture_number_seq start with 1;

-- Replace single-column unique with composite (kind, number) so devis #1
-- and facture #1 can coexist. Original constraint name from CREATE TABLE.
do $$ begin
  alter table public.devis drop constraint if exists devis_devis_number_key;
exception when undefined_object then null; end $$;

do $$ begin
  alter table public.devis add constraint devis_kind_number_uk unique (kind, devis_number);
exception when duplicate_object then null; end $$;

-- ===== 3. Featured employee of the month =====
create table if not exists public.featured_employees (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  month       text not null,                 -- 'YYYY-MM'
  reason      text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (month)
);

alter table public.featured_employees enable row level security;

drop policy if exists "featured_employees_read_all" on public.featured_employees;
create policy "featured_employees_read_all"
  on public.featured_employees
  for select using (auth.uid() is not null);

drop policy if exists "featured_employees_admin_write" on public.featured_employees;
create policy "featured_employees_admin_write"
  on public.featured_employees
  for all using (public.is_admin()) with check (public.is_admin());

-- ===== 4. Avatars storage bucket =====
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage policies for the avatars bucket
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_admin_insert" on storage.objects;
create policy "avatars_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and public.is_admin());

drop policy if exists "avatars_admin_update" on storage.objects;
create policy "avatars_admin_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and public.is_admin());

drop policy if exists "avatars_admin_delete" on storage.objects;
create policy "avatars_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and public.is_admin());

-- ===== 5. Helper RPC: nextval_seq (used by devis builder for facture numbers) =====
create or replace function public.nextval_seq(seq_name text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if seq_name not in ('devis_number_seq', 'facture_number_seq') then
    raise exception 'Sequence not allowed';
  end if;
  return nextval(format('public.%I', seq_name)::regclass);
end
$$;
