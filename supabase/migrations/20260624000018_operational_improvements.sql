-- ============================================================
-- Phase 18 — Operational Improvements
-- Tasks: estimated_minutes, completion fields, late reason
-- Finance: follow-up tracking on outstanding devis
-- Updates: in-app update notification system
-- ============================================================

-- ── Tasks: new operational fields ──────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS estimated_minutes   integer  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS started_at          timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at        timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS late_reason         text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completion_note     text     DEFAULT NULL;

-- ── Finance: follow-up tracking on devis ──────────────────
ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS last_followup_at    timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS next_followup_at    date        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS followup_note       text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contacted           boolean     DEFAULT false;

-- ── In-app update notification system ─────────────────────
CREATE TABLE IF NOT EXISTS app_updates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version       text NOT NULL,
  title         text NOT NULL,
  summary       text,
  released_at   timestamptz NOT NULL DEFAULT now(),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_update_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id   uuid NOT NULL REFERENCES app_updates(id) ON DELETE CASCADE,
  role        text DEFAULT NULL,     -- 'admin' | 'worker' | 'freelancer' | NULL (all)
  section     text DEFAULT NULL,     -- 'tasks' | 'finance' | 'team' | 'planning' | NULL (global)
  title       text NOT NULL,
  body        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_update_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  update_id   uuid NOT NULL REFERENCES app_updates(id) ON DELETE CASCADE,
  section     text DEFAULT NULL,
  seen_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, update_id, section)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_updates_active ON app_updates(active, released_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_update_items_update ON app_update_items(update_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_user_update_views_user ON user_update_views(user_id, update_id);

-- ── RLS for update system ──────────────────────────────────
ALTER TABLE app_updates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_update_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_update_views ENABLE ROW LEVEL SECURITY;

-- app_updates: anyone authenticated can read active ones; only admin can write
CREATE POLICY "updates_read" ON app_updates
  FOR SELECT USING (auth.uid() IS NOT NULL AND active = true);
CREATE POLICY "updates_admin_write" ON app_updates
  FOR ALL USING (current_role() = 'admin');

-- app_update_items: authenticated read; admin write
CREATE POLICY "update_items_read" ON app_update_items
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "update_items_admin_write" ON app_update_items
  FOR ALL USING (current_role() = 'admin');

-- user_update_views: each user manages their own rows
CREATE POLICY "views_own" ON user_update_views
  FOR ALL USING (user_id = auth.uid());

-- ── Seed: first update entry for v1.1 ─────────────────────
INSERT INTO app_updates (version, title, summary, released_at, active)
VALUES (
  '1.1.0',
  'Mise à jour opérationnelle — Juin 2026',
  'Vues de tâches améliorées, suivi du temps, tableau de charge, relances finance, et ce système de nouveautés.',
  now(),
  true
)
ON CONFLICT DO NOTHING;

-- Items for the v1.1 update
WITH u AS (SELECT id FROM app_updates WHERE version = '1.1.0' LIMIT 1)
INSERT INTO app_update_items (update_id, role, section, title, body, sort_order)
SELECT u.id, item.role, item.section, item.title, item.body, item.sort_order
FROM u, (VALUES
  (NULL,         NULL,       'Filtres rapides de tâches',          'Nouveaux raccourcis : Aujourd''hui, En retard, Cette semaine, En cours, À valider, Mes tâches.', 1),
  (NULL,         'tasks',    'Temps estimé sur les tâches',        'Ajoutez une estimation de temps lors de la création ou de l''édition d''une tâche. Visible sur les cartes.', 2),
  (NULL,         'tasks',    'Raison de retard & note finale',     'Quand une tâche est en retard, renseignez la raison. À la fermeture, ajoutez une note de livraison.', 3),
  ('admin',      'tasks',    'Tableau de charge équipe',           'Nouvelle vue Workload : charge active, retards et alertes de surcharge par membre.', 4),
  ('admin',      'finance',  'Relances impayés intégrées',         'Boutons d''action directement dans la liste des impayés : suivre, créer tâche, noter la prochaine relance.', 5),
  ('admin',      'planning', 'Planning connecté à la charge',      'Le planning affiche maintenant la charge et les retards de chaque membre pour la journée.', 6),
  (NULL,         NULL,       'Système de nouveautés',              'Ce panneau s''affiche automatiquement à chaque mise à jour. Une seule fois par version.', 7)
) AS item(role, section, title, body, sort_order)
ON CONFLICT DO NOTHING;
