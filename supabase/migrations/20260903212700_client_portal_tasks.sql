begin;

-- Client-facing task tracking. The view owns the membership filter and exposes
-- only delivery information: never assignees, priorities, payroll, creator or
-- internal activity/comments.
create or replace view public.portal_tasks
  with (security_barrier = true) as
  select
    t.id,
    t.project_id,
    t.parent_task_id,
    p.name as project_name,
    t.title,
    t.description,
    t.status,
    t.deadline
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.work_scope = 'client'
    and public.client_contact_of(p.client_id);

comment on view public.portal_tasks is
  'Client-visible project task tracking. Omits assignees, priorities, payroll, creator, estimates, activity and comments.';

revoke all on public.portal_tasks from public, anon, authenticated;
grant select on public.portal_tasks to authenticated;

commit;
