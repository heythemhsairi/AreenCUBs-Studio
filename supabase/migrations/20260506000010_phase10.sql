-- Areen CUBs Studio — Phase 10
-- 1) Devis: discount + parent_devis_id (for "Convert to facture")
-- 2) Settings: bank info + payment terms
-- 3) Task files (private Supabase Storage bucket)

-- ===== Devis =====
alter table public.devis
  add column if not exists discount_dt numeric(10,2) not null default 0;

alter table public.devis
  add column if not exists parent_devis_id uuid
    references public.devis(id) on delete set null;

create index if not exists devis_parent_idx on public.devis(parent_devis_id);

-- ===== Settings =====
alter table public.settings add column if not exists bank_name text;
alter table public.settings add column if not exists bank_iban text;
alter table public.settings add column if not exists bank_rib text;
alter table public.settings add column if not exists payment_terms text;

-- ===== Task files =====
create table if not exists public.task_files (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  name          text not null,
  mime          text,
  size_bytes    integer,
  storage_path  text not null,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists task_files_task_idx on public.task_files(task_id);

alter table public.task_files enable row level security;

drop policy if exists "task_files_admin_all" on public.task_files;
create policy "task_files_admin_all"
  on public.task_files for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "task_files_worker_all" on public.task_files;
create policy "task_files_worker_all"
  on public.task_files for all
  using (public.current_role() = 'worker')
  with check (public.current_role() = 'worker');

drop policy if exists "task_files_freelancer_own" on public.task_files;
create policy "task_files_freelancer_own"
  on public.task_files for all
  using (
    public.current_role() = 'freelancer'
    and exists (
      select 1 from public.tasks t
      where t.id = task_files.task_id and t.assignee_id = auth.uid()
    )
  )
  with check (
    public.current_role() = 'freelancer'
    and exists (
      select 1 from public.tasks t
      where t.id = task_files.task_id and t.assignee_id = auth.uid()
    )
  );

-- Private bucket for task attachments (signed-URL access)
insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', false)
on conflict (id) do nothing;

drop policy if exists "task_files_storage_select" on storage.objects;
create policy "task_files_storage_select"
  on storage.objects for select
  using (bucket_id = 'task-files' and auth.uid() is not null);

drop policy if exists "task_files_storage_insert" on storage.objects;
create policy "task_files_storage_insert"
  on storage.objects for insert
  with check (bucket_id = 'task-files' and auth.uid() is not null);

drop policy if exists "task_files_storage_delete" on storage.objects;
create policy "task_files_storage_delete"
  on storage.objects for delete
  using (bucket_id = 'task-files' and auth.uid() is not null);
