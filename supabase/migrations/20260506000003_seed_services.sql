-- Areen CUBs Studio — Seed service catalog
-- Pre-loads the 17 services from the historical devis (EST-0034/0035/0036).
-- Treated as a migration so `supabase db push` applies it. Idempotent.

-- ── Fresh-database guard ─────────────────────────────────────────────────────
-- The INSERT below uses `on conflict (name_fr)`, which requires a unique index
-- on services.name_fr. That constraint is created by migration
-- 20260506000007_services_unique_name.sql — which runs LATER. On an empty
-- database this file therefore aborted at statement 0 with:
--
--   ERROR: there is no unique or exclusion constraint matching the
--          ON CONFLICT specification            (SQLSTATE 42P10)
--
-- The dependency was introduced when migration 7 retroactively patched this
-- file (see its header: "The seed file (0003) is also patched to use
-- `on conflict (name_fr)`"), which made the chain non-reproducible from empty.
-- Existing environments are unaffected: this migration is already recorded as
-- applied there and will not re-run. Migration 7 guards its own ADD CONSTRAINT
-- against duplicate_object, so it remains a no-op once this has run.
-- An existence check rather than an exception handler: ADD CONSTRAINT ... UNIQUE
-- builds an index of the same name, so a name collision raises duplicate_table
-- (42P07, "relation already exists") BEFORE the duplicate_object (42710) that a
-- naive `exception when duplicate_object` handler would catch. Testing for the
-- constraint directly avoids depending on which SQLSTATE surfaces first.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_name_fr_uk'
  ) then
    alter table public.services
      add constraint services_name_fr_uk unique (name_fr);
  end if;
end $$;

insert into public.services (name_fr, name_en, category, default_price_dt, default_unit)
values
  ('Identité de Marque', 'Brand identity', 'branding', 550.00, 'package'),
  ('Identité de marque basée sur un logo existant', 'Brand identity from existing logo', 'branding', 300.00, 'package'),
  ('Traçage de logo', 'Logo vectorization', 'branding', 50.00, 'unit'),
  ('Conception de Flyer', 'Flyer design', 'design', 100.00, 'unit'),
  ('Conception de Flyer — Version 2', 'Flyer design — V2', 'design', 50.00, 'unit'),
  ('Carte de Visite', 'Business card', 'design', 50.00, 'unit'),
  ('Bannière LinkedIn', 'LinkedIn banner', 'social', 75.00, 'unit'),
  ('Pitch Deck', 'Pitch deck', 'presentation', 100.00, 'unit'),
  ('Pitch Deck + Google Form', 'Pitch deck + Google Form', 'presentation', 120.00, 'unit'),
  ('Publication LinkedIn', 'LinkedIn post', 'social', 50.00, 'unit'),
  ('Publication social media', 'Social media post', 'social', 50.00, 'unit'),
  ('Conception de carrousel', 'Carousel design', 'social', 80.00, 'unit'),
  ('Conception de roll-up', 'Roll-up design', 'print', 100.00, 'unit'),
  ('QR code premium trackable (validité 12 mois)', 'Premium trackable QR code (12 months)', 'tooling', 50.00, 'unit'),
  ('Stratégie marketing complète (positionnement, contenu, plan d''action)', 'Complete marketing strategy', 'strategy', 350.00, 'package'),
  ('Gestion des réseaux sociaux', 'Social media management', 'social', 100.00, 'month')
on conflict (name_fr) do nothing;

-- Social media management is split into 3 tiers (Pack Essentiel / Performance / Premium).
insert into public.services (name_fr, name_en, description_fr, category, default_price_dt, default_unit)
values
  (
    'Gestion réseaux sociaux — Pack Essentiel',
    'Social media management — Essentiel pack',
    '4 publications par mois · 1 visuel par semaine · suivi stratégique mensuel · reporting simple',
    'social', 180.00, 'month'
  ),
  (
    'Gestion réseaux sociaux — Pack Performance',
    'Social media management — Performance pack',
    '8 publications par mois · 2 reels · stories quotidiennes · 2 visuels par semaine · suivi stratégique bi-mensuel · reporting détaillé',
    'social', 380.00, 'month'
  ),
  (
    'Gestion réseaux sociaux — Pack Premium',
    'Social media management — Premium pack',
    '12 publications par mois · reels hebdomadaires · stories quotidiennes · campagnes saisonnières · reporting analytique mensuel · veille concurrentielle',
    'social', 600.00, 'month'
  )
on conflict (name_fr) do nothing;
