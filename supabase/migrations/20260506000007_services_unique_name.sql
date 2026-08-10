-- Areen CUBs Studio — Services dedupe + unique constraint
-- The original seed used `on conflict do nothing` without a target, which
-- only fires on the primary key (random UUID, never collides). Every
-- migration re-run inserted 17 fresh duplicates. This migration:
--   1) Removes duplicate rows, keeping the oldest per name_fr
--   2) Adds a UNIQUE constraint on name_fr so it can't happen again
-- The seed file (0003) is also patched to use `on conflict (name_fr)`.

with ranked as (
  select id, name_fr, created_at,
         row_number() over (
           partition by name_fr order by created_at asc, id asc
         ) as rn
  from public.services
)
delete from public.services s
using ranked r
where s.id = r.id and r.rn > 1;

-- Existence check rather than an exception handler. On a fresh database
-- migration 0003 now creates this constraint itself (it needs it for its own
-- ON CONFLICT target), so this statement re-runs against an existing
-- constraint. That raises duplicate_table (42P07, "relation already exists")
-- from the underlying index build — NOT duplicate_object (42710) — so the
-- previous `exception when duplicate_object` guard did not catch it and the
-- migration aborted. Already-migrated environments are unaffected: this file
-- is recorded as applied and will not re-run.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_name_fr_uk'
  ) then
    alter table public.services
      add constraint services_name_fr_uk unique (name_fr);
  end if;
end $$;
