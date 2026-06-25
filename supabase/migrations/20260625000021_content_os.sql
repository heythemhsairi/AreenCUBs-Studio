-- Content OS: client content profiles, monthly plans, content items
-- Migration 21 — 2026-06-25

-- ─── 1. client_content_profiles ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_content_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_voice     text,
  industry        text,
  target_audience text,
  services        text,
  platforms       text[] NOT NULL DEFAULT '{}',
  monthly_goal    text,
  posting_frequency text,
  content_pillars text[] NOT NULL DEFAULT '{}',
  design_direction text,
  forbidden_topics text,
  competitors     text,
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);

-- ─── 2. monthly_content_plans ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_content_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  month       smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        smallint NOT NULL CHECK (year >= 2020),
  theme       text,
  goals       text,
  status      text NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'approved', 'archived')),
  created_by  uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, month, year)
);

-- ─── 3. content_items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          uuid NOT NULL REFERENCES monthly_content_plans(id) ON DELETE CASCADE,
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title            text NOT NULL,
  content_type     text NOT NULL DEFAULT 'post'
                   CHECK (content_type IN ('post', 'reel', 'story', 'carousel', 'video', 'article')),
  platform         text NOT NULL DEFAULT 'instagram'
                   CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube', 'threads')),
  pillar           text,
  caption          text,
  visual_direction text,
  publish_date     date,
  deadline         date,
  assigned_to      uuid REFERENCES auth.users(id),
  status           text NOT NULL DEFAULT 'idea'
                   CHECK (status IN ('idea', 'copywriting', 'design', 'editing', 'internal_review', 'client_review', 'approved', 'scheduled', 'published')),
  priority         text NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  client_feedback  text,
  approval_status  text DEFAULT 'pending'
                   CHECK (approval_status IN ('pending', 'approved', 'revision_requested')),
  final_asset_url  text,
  task_id          uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_content_items_plan    ON content_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_content_items_client  ON content_items(client_id);
CREATE INDEX IF NOT EXISTS idx_content_items_date    ON content_items(publish_date);
CREATE INDEX IF NOT EXISTS idx_content_items_status  ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_plans_client  ON monthly_content_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_content_plans_month   ON monthly_content_plans(year, month);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_content_profiles_updated_at') THEN
    CREATE TRIGGER trg_content_profiles_updated_at
      BEFORE UPDATE ON client_content_profiles
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_content_plans_updated_at') THEN
    CREATE TRIGGER trg_content_plans_updated_at
      BEFORE UPDATE ON monthly_content_plans
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_content_items_updated_at') THEN
    CREATE TRIGGER trg_content_items_updated_at
      BEFORE UPDATE ON content_items
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE client_content_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_content_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items           ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all content data
CREATE POLICY "content_profiles_read"  ON client_content_profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "content_plans_read"     ON monthly_content_plans   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "content_items_read"     ON content_items           FOR SELECT USING (auth.role() = 'authenticated');

-- Write: authenticated workers+admins (service role always bypasses)
CREATE POLICY "content_profiles_write" ON client_content_profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "content_plans_write"    ON monthly_content_plans   FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "content_items_write"    ON content_items           FOR ALL USING (auth.role() = 'authenticated');
