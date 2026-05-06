-- Areen CUBs Studio — Seed service catalog
-- Pre-loads the 17 services from the historical devis (EST-0034/0035/0036).
-- Treated as a migration so `supabase db push` applies it. Idempotent.

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
  ('Gestion des réseaux sociaux', 'Social media management', 'social', 100.00, 'month'),
  ('Gestion réseaux sociaux + recherche stratégique + suivi opérationnel', 'Full social media management + strategy', 'social', 180.00, 'month')
on conflict do nothing;
