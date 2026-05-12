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

do $$ begin
  alter table public.services
    add constraint services_name_fr_uk unique (name_fr);
exception when duplicate_object then null; end $$;
