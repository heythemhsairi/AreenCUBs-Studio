-- Areen CUBs Studio — Subtasks
-- Lets a task have child sub-tasks via a self-referencing FK.
-- Cascade on delete so removing a parent removes its sub-tasks.

alter table public.tasks
  add column if not exists parent_task_id uuid
    references public.tasks(id) on delete cascade;

create index if not exists tasks_parent_idx on public.tasks(parent_task_id);
