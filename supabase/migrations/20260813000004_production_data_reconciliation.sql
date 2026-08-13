-- Reconcile data effects that are absent from production even though the
-- corresponding schema objects already exist. Every statement is idempotent
-- and preserves user-managed rows and values.

begin;

-- Video review policies already exist in production, but the private bucket
-- row does not. Without it, every upload fails before RLS is evaluated.
insert into storage.buckets (id, name, public)
values ('review-media', 'review-media', false)
on conflict (id) do nothing;

-- Complete the historical single-assignee to join-table backfill. Keep both
-- joins defensive so the repair remains safe after partial/manual repairs.
insert into public.task_assignees (task_id, user_id)
select id, assignee_id
from public.tasks
where assignee_id is not null
  and exists (select 1 from auth.users u where u.id = tasks.assignee_id)
on conflict do nothing;

insert into public.project_assignees (project_id, user_id)
select id, owner_id
from public.projects
where owner_id is not null
  and exists (select 1 from auth.users u where u.id = projects.owner_id)
on conflict do nothing;

-- Production has the payroll schema but none of the default task types. A
-- code conflict always preserves the existing administrator-managed row.
insert into public.payroll_task_types
  (code, label, base_rate_millimes, above_rate_millimes, output_points, position)
values
  ('video', 'Vidéo', 40000, 60000, 1, 10),
  ('post', 'Post', 8000, 12000, 1, 20),
  ('carousel', 'Carrousel', 24000, 36000, 3, 30),
  ('script', 'Script', 8000, 12000, 1, 40),
  ('publication', 'Publication', 10000, 15000, 1, 50),
  ('marketing_strategy', 'Stratégie marketing', 60000, 90000, 3, 60),
  ('brand_identity', 'Identité de marque', 120000, 180000, 5, 70)
on conflict (code) do nothing;

-- This manually-added catalogue row is the only production service without
-- an English name. Do not touch any row that already carries a translation.
update public.services
set name_en = 'Social Media Post'
where name_fr = 'Social Media Post'
  and coalesce(btrim(name_en), '') = '';

commit;
