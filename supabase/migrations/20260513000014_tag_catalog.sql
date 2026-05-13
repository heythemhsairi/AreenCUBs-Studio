-- Phase 13: managed tag catalog
--
-- Tasks already store tags as TEXT[]; this table is the *catalog* — it lets
-- you assign a stable color and define which tags exist, without breaking
-- the array storage on tasks. Tag names normalized to lowercase, no #.

CREATE TABLE IF NOT EXISTS public.task_tag_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 32),
  color TEXT NOT NULL DEFAULT '#3B8BBA'
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.task_tag_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tag_catalog_select"
  ON public.task_tag_catalog FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "tag_catalog_write"
  ON public.task_tag_catalog FOR ALL
  USING (public.current_role() IN ('admin', 'worker'))
  WITH CHECK (public.current_role() IN ('admin', 'worker'));
