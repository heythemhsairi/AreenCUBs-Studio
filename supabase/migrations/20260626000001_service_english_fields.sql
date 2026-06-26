-- Areen CUBs Studio — Complete English service data
-- 1. Adds the missing description_en column (name_en already exists).
-- 2. Backfills name_en / description_en for existing services, matched by name_fr.
-- Idempotent and non-destructive: only sets the EN columns, never touches the
-- French (name_fr / description_fr) values. UPDATEs that match no row are no-ops,
-- so services that don't exist in a given environment are simply skipped.

-- ── 1. Schema: add description_en ─────────────────────────────────────────────
alter table public.services
  add column if not exists description_en text;

-- ── 2. Backfill English descriptions for the social-media packs ───────────────
update public.services
  set description_en = '4 posts per month · 1 visual per week · monthly strategy follow-up · simple reporting'
  where name_fr = 'Gestion réseaux sociaux — Pack Essentiel'
    and (description_en is null or description_en = '');

update public.services
  set description_en = '8 posts per month · 2 reels · daily stories · 2 visuals per week · bi-monthly strategy follow-up · detailed reporting'
  where name_fr = 'Gestion réseaux sociaux — Pack Performance'
    and (description_en is null or description_en = '');

update public.services
  set description_en = '12 posts per month · weekly reels · daily stories · seasonal campaigns · monthly analytics reporting · competitor monitoring'
  where name_fr = 'Gestion réseaux sociaux — Pack Premium'
    and (description_en is null or description_en = '');

-- ── 3. Backfill name_en for any seeded service still missing it ───────────────
-- (Defensive: in case an earlier seed inserted rows without name_en.)
update public.services set name_en = 'Brand identity'                       where name_fr = 'Identité de Marque' and (name_en is null or name_en = '');
update public.services set name_en = 'Brand identity from existing logo'    where name_fr = 'Identité de marque basée sur un logo existant' and (name_en is null or name_en = '');
update public.services set name_en = 'Logo vectorization'                   where name_fr = 'Traçage de logo' and (name_en is null or name_en = '');
update public.services set name_en = 'Flyer design'                         where name_fr = 'Conception de Flyer' and (name_en is null or name_en = '');
update public.services set name_en = 'Flyer design — V2'                    where name_fr = 'Conception de Flyer — Version 2' and (name_en is null or name_en = '');
update public.services set name_en = 'Business card'                        where name_fr = 'Carte de Visite' and (name_en is null or name_en = '');
update public.services set name_en = 'LinkedIn banner'                      where name_fr = 'Bannière LinkedIn' and (name_en is null or name_en = '');
update public.services set name_en = 'Pitch deck'                           where name_fr = 'Pitch Deck' and (name_en is null or name_en = '');
update public.services set name_en = 'Pitch deck + Google Form'            where name_fr = 'Pitch Deck + Google Form' and (name_en is null or name_en = '');
update public.services set name_en = 'LinkedIn post'                        where name_fr = 'Publication LinkedIn' and (name_en is null or name_en = '');
update public.services set name_en = 'Social media post'                    where name_fr = 'Publication social media' and (name_en is null or name_en = '');
update public.services set name_en = 'Carousel design'                      where name_fr = 'Conception de carrousel' and (name_en is null or name_en = '');
update public.services set name_en = 'Roll-up design'                       where name_fr = 'Conception de roll-up' and (name_en is null or name_en = '');
update public.services set name_en = 'Premium trackable QR code (12 months)' where name_fr = 'QR code premium trackable (validité 12 mois)' and (name_en is null or name_en = '');
update public.services set name_en = 'Complete marketing strategy'          where name_fr = 'Stratégie marketing complète (positionnement, contenu, plan d''action)' and (name_en is null or name_en = '');
update public.services set name_en = 'Social media management'              where name_fr = 'Gestion des réseaux sociaux' and (name_en is null or name_en = '');
update public.services set name_en = 'Social media management — Essentiel pack'   where name_fr = 'Gestion réseaux sociaux — Pack Essentiel' and (name_en is null or name_en = '');
update public.services set name_en = 'Social media management — Performance pack' where name_fr = 'Gestion réseaux sociaux — Pack Performance' and (name_en is null or name_en = '');
update public.services set name_en = 'Social media management — Premium pack'     where name_fr = 'Gestion réseaux sociaux — Pack Premium' and (name_en is null or name_en = '');

-- ── 4. Backfill name_en / description_en for manually-added services ──────────
-- These were created in production after the seed. UPDATEs match by exact
-- name_fr; if a name differs slightly in production it can be set via the
-- service edit form (which now supports EN name + description).
update public.services set name_en = '20-slide carousel design'
  where name_fr = 'Conception de carrousel 20 slides' and (name_en is null or name_en = '');

update public.services set name_en = 'Video editing'
  where name_fr in ('montage vidéo', 'Montage vidéo', 'Montage Vidéo') and (name_en is null or name_en = '');

update public.services set name_en = 'Professional video advertising'
  where name_fr in ('Publicité vidéo professionnelle', 'Publicité Vidéo Professionnelle') and (name_en is null or name_en = '');

-- Known French descriptions → English (matched on the description text itself so
-- it works regardless of which service name carries them).
update public.services
  set description_en = 'brand refresh + brand guidelines + included assets'
  where description_fr = 'refonte de marque + charte graphique + supports inclus'
    and (description_en is null or description_en = '');

update public.services
  set description_en = 'Includes high-quality ad copy, professional voice-over, and high-quality editing.'
  where description_fr = 'Inclure des textes publicitaires de haute qualité. Voix off professionnelle. Montage de haute qualité.'
    and (description_en is null or description_en = '');
