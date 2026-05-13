-- Phase 13: tags + recurring tasks
--
-- Adds a free-form tag array and a recurrence rule to tasks. Recurrence is
-- stored as a simple keyword ('daily' | 'weekly' | 'biweekly' | 'monthly');
-- when a recurring task is marked done, the application creates the next
-- instance with the deadline shifted forward.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurrence TEXT
    CHECK (recurrence IN ('daily', 'weekly', 'biweekly', 'monthly') OR recurrence IS NULL);

-- GIN index for tag filtering / search
CREATE INDEX IF NOT EXISTS tasks_tags_gin_idx ON public.tasks USING GIN (tags);
