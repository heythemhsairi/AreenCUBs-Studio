-- Phase 14: multi-assignee for tasks (incl. subtasks) and projects
--
-- Equal multi-assignees. We keep tasks.assignee_id / projects.owner_id as a
-- denormalized "primary" (first) assignee so existing Kanban / filters /
-- notifications / dashboard counts keep working, and add join tables as the
-- source of truth for the full list + freelancer visibility.

CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS task_assignees_user_idx
  ON public.task_assignees (user_id);

CREATE TABLE IF NOT EXISTS public.project_assignees (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_assignees_user_idx
  ON public.project_assignees (user_id);

-- Backfill from existing single columns
INSERT INTO public.task_assignees (task_id, user_id)
SELECT id, assignee_id FROM public.tasks WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.project_assignees (project_id, user_id)
SELECT id, owner_id FROM public.projects WHERE owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- RLS: assignment metadata is readable by any authenticated user (needed
-- for the EXISTS check inside tasks/projects policies and to render the
-- avatar stack), writable only by admin / worker.
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_assignees_select"
  ON public.task_assignees FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "task_assignees_write"
  ON public.task_assignees FOR ALL
  USING (public.current_role() IN ('admin', 'worker'))
  WITH CHECK (public.current_role() IN ('admin', 'worker'));

CREATE POLICY "project_assignees_select"
  ON public.project_assignees FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "project_assignees_write"
  ON public.project_assignees FOR ALL
  USING (public.current_role() IN ('admin', 'worker'))
  WITH CHECK (public.current_role() IN ('admin', 'worker'));

-- Widen freelancer visibility to the join table (keep assignee_id as a
-- fallback so nothing regresses during/after backfill).
DROP POLICY IF EXISTS tasks_freelancer_select_own ON public.tasks;
CREATE POLICY tasks_freelancer_select_own
  ON public.tasks FOR SELECT
  USING (
    (public.current_role() = 'freelancer'::user_role)
    AND (
      assignee_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.task_assignees ta
        WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS tasks_freelancer_update_own ON public.tasks;
CREATE POLICY tasks_freelancer_update_own
  ON public.tasks FOR UPDATE
  USING (
    (public.current_role() = 'freelancer'::user_role)
    AND (
      assignee_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.task_assignees ta
        WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS projects_freelancer_select_via_tasks ON public.projects;
CREATE POLICY projects_freelancer_select_via_tasks
  ON public.projects FOR SELECT
  USING (
    (public.current_role() = 'freelancer'::user_role)
    AND (
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.project_id = projects.id AND t.assignee_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.task_assignees ta
        JOIN public.tasks t ON t.id = ta.task_id
        WHERE t.project_id = projects.id AND ta.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.project_assignees pa
        WHERE pa.project_id = projects.id AND pa.user_id = auth.uid()
      )
    )
  );
