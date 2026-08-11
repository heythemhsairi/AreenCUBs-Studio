-- ═══════════════════════════════════════════════════════════════════════════
-- Areen CUBs Studio — LOCAL STAGING SEED
--
--   ⚠  LOCAL USE ONLY. Never run against the hosted project.
--      Applied automatically by `supabase db reset` / `npm run db:reset`.
--
-- ── Provenance ─────────────────────────────────────────────────────────────
-- EVERY row below is fabricated. No client name, contact detail, project,
-- amount, invoice or payment has been copied from production. The company
-- names are invented; the addresses and tax numbers are structurally valid
-- but meaningless; the money is round numbers chosen to make the audit
-- findings reproducible.
--
-- ── Passwords ──────────────────────────────────────────────────────────────
-- The staging accounts share the password `staging-only-not-a-secret`.
-- This is a fixture for a database that exists only inside this machine and
-- is destroyed by every `db reset`. It is not a credential and must never be
-- reused anywhere else.
--
-- ── Purpose ────────────────────────────────────────────────────────────────
-- The data is arranged so the confirmed audit findings can be reproduced and
-- then verified as fixed, without touching production:
--
--   #1  Content OS   — profiles/plans/items exercised end to end
--   #3  Publishing   — scheduled posts left in the past
--   #5  Finance      — the exact "paid invoice with a balance" contradiction
--   #6  Projects     — a completed project still holding open tasks
--   #7  Projects     — an active project past its deadline
--   #18 Services     — `Branding` and `branding` as separate categories
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── Clean slate (local only; order respects foreign keys) ──────────────────
truncate table
  public.review_comments,
  public.review_versions,
  public.review_assets,
  public.payments,
  public.devis_items,
  public.devis,
  public.task_comments,
  public.tasks,
  public.projects,
  public.client_members,
  public.clients,
  public.audit_log
restart identity cascade;

delete from auth.users where email like '%@staging.local';

-- ═══ 1. Staging accounts ═══════════════════════════════════════════════════
-- One per role in the current user_role enum, so RLS can be exercised as
-- each principal. A fourth user is created WITHOUT a profile row to prove
-- the Phase 1d fail-closed behaviour.

-- GoTrue scans confirmation_token / recovery_token / email_change* as
-- non-nullable Go strings. Leaving them NULL makes sign-in fail with
--   "Scan error on column ... converting NULL to string is unsupported"
-- and a 500 from /token, which looks like a wrong password but is not.
-- They must be empty strings, not NULL.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  v.id::uuid, v.instance_id::uuid, v.aud, v.role, v.email, v.encrypted_password,
  v.email_confirmed_at::timestamptz, v.created_at::timestamptz, v.updated_at::timestamptz,
  v.raw_app_meta_data::jsonb, v.raw_user_meta_data::jsonb,
  '', '', '', '', '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@staging.local',
   crypt('staging-only-not-a-secret', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),

  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'worker@staging.local',
   crypt('staging-only-not-a-secret', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),

  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'freelancer@staging.local',
   crypt('staging-only-not-a-secret', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),

  -- Deliberately has NO profiles row. Signing in as this user must be DENIED
  -- and routed to /account-unavailable — never silently granted freelancer.
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'orphan@staging.local',
   crypt('staging-only-not-a-secret', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),

  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'commercial@staging.local',
   crypt('staging-only-not-a-secret', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),

  ('66666666-6666-4666-8666-666666666666', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'intern@staging.local',
   crypt('staging-only-not-a-secret', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),

  -- A person from a client organisation, not an employee. Every internal
  -- table must be unreachable for this account.
  ('77777777-7777-4777-8777-777777777777', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client@staging.local',
   crypt('staging-only-not-a-secret', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}')
) as v(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
);

-- GoTrue resolves a password grant through auth.identities, not auth.users
-- alone. Without an identity row the account exists but cannot sign in.
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from auth.users u
where u.email like '%@staging.local'
on conflict do nothing;

insert into public.profiles (id, username, full_name, role) values
  ('11111111-1111-4111-8111-111111111111', 'admin',      'Staging Admin',      'admin'),
  ('22222222-2222-4222-8222-222222222222', 'worker',     'Staging Worker',     'worker'),
  ('33333333-3333-4333-8333-333333333333', 'freelancer', 'Staging Freelancer', 'freelancer'),
  ('55555555-5555-4555-8555-555555555555', 'commercial', 'Staging Commercial', 'commercial'),
  ('66666666-6666-4666-8666-666666666666', 'intern',     'Staging Intern',     'intern'),
  ('77777777-7777-4777-8777-777777777777', 'client',     'Staging Client Contact', 'client')
on conflict (id) do update
  set username = excluded.username,
      full_name = excluded.full_name,
      role = excluded.role;

-- ═══ 2. Fabricated clients ═════════════════════════════════════════════════
insert into public.clients (id, name, address, matricule_fiscal, email, phone, notes, created_by) values
  ('c1000000-0000-4000-8000-000000000001', 'Atlas Foods SARL',
   '12 Rue Exemple, Tunis 1000', 'FAKE-0000001AAA000',
   'contact@atlasfoods.invalid', '+216 00 000 001',
   'FABRICATED staging client.', '11111111-1111-4111-8111-111111111111'),

  ('c1000000-0000-4000-8000-000000000002', 'Nova Immobilier',
   '5 Avenue Fictive, Sousse 4000', 'FAKE-0000002BBB000',
   'hello@novaimmo.invalid', '+216 00 000 002',
   'FABRICATED staging client.', '11111111-1111-4111-8111-111111111111'),

  ('c1000000-0000-4000-8000-000000000003', 'Zenith Fitness',
   '88 Rue Imaginaire, Sfax 3000', 'FAKE-0000003CCC000',
   'team@zenithfit.invalid', '+216 00 000 003',
   'FABRICATED staging client — no content profile, tests the empty state.',
   '11111111-1111-4111-8111-111111111111'),

  -- Deliberately outside every worker's scope: no project, no task, and
  -- created by the commercial user rather than the admin. Without a client
  -- like this the worker-containment assertions would pass vacuously, because
  -- the staging worker owns all three projects above and would therefore be
  -- linked to every other client in the seed.
  ('c1000000-0000-4000-8000-000000000004', 'Meridian Logistique',
   '3 Impasse Inventée, Bizerte 7000', 'FAKE-0000004DDD000',
   'bonjour@meridianlog.invalid', '+216 00 000 004',
   'FABRICATED staging client — commercial-owned, no delivery work attached.',
   '55555555-5555-4555-8555-555555555555');

-- ═══ 3. Projects — findings #6 and #7 ══════════════════════════════════════
insert into public.projects (id, client_id, name, description, status, owner_id, start_date, end_date) values
  -- #7: still "active" although the deadline passed. Derived health must
  --     report Overdue while the manual status stays untouched.
  ('e1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'Refonte identité Atlas', 'FABRICATED. Deadline in the past, status still active.',
   'active', '22222222-2222-4222-8222-222222222222', '2026-05-01', '2026-07-31'),

  -- #6: marked completed while open tasks remain attached.
  ('e1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002',
   'Campagne printemps Nova', 'FABRICATED. Completed but still holds open tasks.',
   'completed', '22222222-2222-4222-8222-222222222222', '2026-03-01', '2026-06-30'),

  ('e1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003',
   'Lancement Zenith', 'FABRICATED. Healthy control project.',
   'active', '22222222-2222-4222-8222-222222222222', '2026-08-01', '2026-12-31');

insert into public.tasks (id, project_id, title, status, priority, assignee_id, created_by, deadline) values
  ('7a000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
   'Direction artistique — planches', 'in_progress', 'high',
   '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '2026-07-20'),

  ('7a000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001',
   'Charte graphique — livraison', 'todo', 'urgent',
   '33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '2026-07-28'),

  -- #6: these two are open on a project whose status is 'completed'.
  ('7a000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000002',
   'Retouches visuels campagne', 'in_progress', 'normal',
   '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '2026-06-25'),

  ('7a000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002',
   'Rapport de performance', 'todo', 'low',
   '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '2026-07-05'),

  ('7a000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000003',
   'Brief client initial', 'done', 'normal',
   '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '2026-08-05'),

  -- The intern's live work. Task #5 above is already 'done', so without an
  -- open task the intern dashboard would render an empty state and its tests
  -- would assert nothing. Assigned through task_assignees below, on the same
  -- project, so the intern's whole world stays a single client.
  ('7a000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000003',
   'Préparer la revue de contenu', 'in_progress', 'normal',
   '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '2026-08-20');

-- ═══ 3b. Explicit membership and assignment ════════════════════════════════
-- The scope rows every Phase 2 policy resolves through. Access is never
-- inferred from an email domain or a name, so without these rows the
-- commercial, intern and client accounts reach nothing at all — which is
-- itself one of the assertions.

insert into public.client_members (client_id, profile_id, relation, created_by) values
  -- Commercial owns Nova by assignment, and Meridian by authorship.
  ('c1000000-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555',
   'commercial_owner', '11111111-1111-4111-8111-111111111111'),

  -- The portal contact belongs to Atlas Foods. Atlas is deliberately NOT the
  -- commercial's client, so "client sees own organisation" and "commercial
  -- sees own clients" cannot accidentally overlap and mask a leak.
  ('c1000000-0000-4000-8000-000000000001', '77777777-7777-4777-8777-777777777777',
   'client_contact', '11111111-1111-4111-8111-111111111111')
on conflict do nothing;

update public.clients
   set owner_id = '55555555-5555-4555-8555-555555555555'
 where id in ('c1000000-0000-4000-8000-000000000002',
              'c1000000-0000-4000-8000-000000000004');

-- The multi-assignee tables are the source of truth for visibility. Migration
-- 0015 backfills them from tasks.assignee_id / projects.owner_id at migration
-- time, which is BEFORE this seed runs, so seeded rows need explicit entries.
insert into public.task_assignees (task_id, user_id)
select id, assignee_id from public.tasks where assignee_id is not null
on conflict do nothing;

insert into public.project_assignees (project_id, user_id)
select id, owner_id from public.projects where owner_id is not null
on conflict do nothing;

-- The intern gets exactly one task, on the Zenith project. Their entire world
-- is therefore client #3 — every other client, project and task must be
-- invisible to them.
insert into public.task_assignees (task_id, user_id) values
  ('7a000000-0000-4000-8000-000000000005', '66666666-6666-4666-8666-666666666666'),
  ('7a000000-0000-4000-8000-000000000006', '66666666-6666-4666-8666-666666666666')
on conflict do nothing;

-- A draft quote for a commercial-owned client, so the draft-only rule has
-- something to act on. Devis #9005 above is already 'sent' for Nova, which
-- gives the "cannot edit an issued document" case its fixture.
insert into public.devis (
  id, devis_number, kind, client_id, date, due_date, object,
  status, payment_status, subtotal_dt, discount_dt, tva_rate, tva_dt, stamp_dt, total_dt, created_by
) values
  ('d1000000-0000-4000-8000-000000000006', 9006, 'devis',
   'c1000000-0000-4000-8000-000000000004', '2026-08-05', '2026-08-19',
   'FABRICATED — commercial-authored draft quote',
   'draft', 'unpaid', 1500.00, 0.00, 19.00, 285.00, 0.00, 1785.00,
   '55555555-5555-4555-8555-555555555555')
on conflict do nothing;

-- A document with TVA switched OFF. Attached to Atlas (the admin's client)
-- rather than a commercial-owned one, so the commercial scoping counts in
-- role-matrix.dbtest.mjs are untouched.
--
-- Its whole purpose is display: with tva_enabled false the detail view and the
-- printed document must state no tax at all, rather than a rate that produced
-- zero. Totals are deliberately trivial so the assertion is unambiguous.
insert into public.devis (
  id, devis_number, kind, client_id, date, due_date, object,
  status, payment_status, subtotal_dt, discount_dt,
  tva_enabled, tva_rate, tva_dt, stamp_dt, total_dt, created_by
) values
  ('d1000000-0000-4000-8000-000000000007', 9007, 'devis',
   'c1000000-0000-4000-8000-000000000001', '2026-08-08', '2026-08-22',
   'FABRICATED — devis sans TVA',
   'draft', 'unpaid', 800.00, 0.00,
   false, 19.00, 0.00, 0.00, 800.00,
   '11111111-1111-4111-8111-111111111111')
on conflict do nothing;

insert into public.devis_items (devis_id, description, quantity, unit_price_dt, line_total_dt, position, is_bonus) values
  ('d1000000-0000-4000-8000-000000000007', 'Prestation hors champ TVA', 1, 800.00, 800.00, 0, false)
on conflict do nothing;

-- Its line item. Without this the document's stored subtotal would not
-- reconcile against its lines, and finance.dbtest.mjs asserts — correctly —
-- that no seeded document is internally inconsistent.
insert into public.devis_items (devis_id, description, quantity, unit_price_dt, line_total_dt, position, is_bonus) values
  ('d1000000-0000-4000-8000-000000000006', 'Refonte réseaux sociaux', 1, 1500.00, 1500.00, 0, false)
on conflict do nothing;

-- ═══ 4. Services — finding #18 (case-only duplicate categories) ════════════
insert into public.services (name_fr, name_en, category, default_price_dt, default_unit) values
  ('Identité visuelle',      'Brand identity',   'Branding',  2500.00, 'package'),
  ('Charte graphique',       'Brand guidelines', 'branding',  1200.00, 'unit'),
  ('Gestion réseaux sociaux','Social media',     'Social',     900.00, 'month')
on conflict do nothing;

-- ═══ 5. Finance — finding #5 reproduced exactly ════════════════════════════
-- The contradiction: an invoice whose stored payment_status says 'paid' but
-- whose payments fall 1.00 DT short of total_dt. The global unpaid KPI
-- filters on payment_status and reports 0, while the client risk table
-- recomputes invoiced − collected and reports 1 DT. Both read the same row.
--
-- The 1 DT gap mirrors production's cause: migration 20260626000003 raised
-- total_dt by the fiscal stamp on already-settled invoices without
-- reconciling the payments or the status.

insert into public.devis (
  id, devis_number, kind, client_id, date, due_date, object,
  status, payment_status, subtotal_dt, discount_dt, tva_rate, tva_dt, stamp_dt, total_dt, created_by
) values
  -- (a) The contradiction. 1190.00 paid against a 1191.00 total, marked paid.
  ('d1000000-0000-4000-8000-000000000001', 9001, 'facture',
   'c1000000-0000-4000-8000-000000000001', '2026-06-10', '2026-06-24',
   'FABRICATED — settled invoice left 1 DT short by the stamp heal migration',
   'accepted', 'paid', 1000.00, 0.00, 19.00, 190.00, 1.00, 1191.00,
   '11111111-1111-4111-8111-111111111111'),

  -- (b) A draft invoice marked paid — an impossible state the constraints
  --     introduced in Phase 1 must reject.
  ('d1000000-0000-4000-8000-000000000002', 9002, 'facture',
   'c1000000-0000-4000-8000-000000000002', '2026-07-02', '2026-07-16',
   'FABRICATED — draft carrying a paid payment_status',
   'draft', 'paid', 500.00, 0.00, 19.00, 95.00, 1.00, 596.00,
   '11111111-1111-4111-8111-111111111111'),

  -- (c) A draft QUOTE carrying a payment_status at all. Quotes have no
  --     payment concept; the column exists on every row regardless.
  ('d1000000-0000-4000-8000-000000000003', 9003, 'devis',
   'c1000000-0000-4000-8000-000000000003', '2026-08-01', '2026-08-15',
   'FABRICATED — quote wrongly carrying payment state',
   'draft', 'unpaid', 3000.00, 0.00, 19.00, 570.00, 0.00, 3570.00,
   '11111111-1111-4111-8111-111111111111'),

  -- (d) Genuinely overdue and unpaid — the control case.
  ('d1000000-0000-4000-8000-000000000004', 9004, 'facture',
   'c1000000-0000-4000-8000-000000000001', '2026-06-01', '2026-06-15',
   'FABRICATED — genuinely overdue invoice',
   'sent', 'unpaid', 2000.00, 0.00, 19.00, 380.00, 1.00, 2381.00,
   '11111111-1111-4111-8111-111111111111'),

  -- (e) Partially paid — exercises balance derivation.
  ('d1000000-0000-4000-8000-000000000005', 9005, 'facture',
   'c1000000-0000-4000-8000-000000000002', '2026-07-20', '2026-08-20',
   'FABRICATED — partially paid invoice',
   'sent', 'partial', 4000.00, 200.00, 19.00, 722.00, 1.00, 4523.00,
   '11111111-1111-4111-8111-111111111111');

insert into public.devis_items (devis_id, description, quantity, unit_price_dt, line_total_dt, position, is_bonus) values
  ('d1000000-0000-4000-8000-000000000001', 'Identité visuelle complète', 1, 1000.00, 1000.00, 0, false),
  ('d1000000-0000-4000-8000-000000000002', 'Community management',       1,  500.00,  500.00, 0, false),
  ('d1000000-0000-4000-8000-000000000003', 'Refonte site vitrine',       1, 3000.00, 3000.00, 0, false),
  -- A bonus line: priced but free. Its price must never reach the subtotal.
  ('d1000000-0000-4000-8000-000000000003', 'Séance photo offerte',       1,  400.00,    0.00, 1, true),
  ('d1000000-0000-4000-8000-000000000004', 'Campagne publicitaire',      1, 2000.00, 2000.00, 0, false),
  ('d1000000-0000-4000-8000-000000000005', 'Production vidéo',           2, 2000.00, 4000.00, 0, false);

insert into public.payments (devis_id, amount_dt, paid_at, method, notes, recorded_by) values
  -- 1190.00 against a 1191.00 total: the 1 DT contradiction.
  ('d1000000-0000-4000-8000-000000000001', 1190.00, '2026-06-20', 'virement',
   'FABRICATED — 1 DT short of total_dt while status says paid',
   '11111111-1111-4111-8111-111111111111'),
  ('d1000000-0000-4000-8000-000000000005', 2000.00, '2026-08-01', 'espèces',
   'FABRICATED — partial payment', '11111111-1111-4111-8111-111111111111');

-- ═══ 6. Content OS — finding #1 ════════════════════════════════════════════
-- Only inserted if migration 21 actually applied. If these tables are absent
-- the seed fails loudly here, which is precisely the signal we want: it means
-- the Content OS schema did not land.

insert into public.client_content_profiles
  (client_id, brand_voice, industry, target_audience, platforms, monthly_goal, posting_frequency, content_pillars, created_by)
values
  ('c1000000-0000-4000-8000-000000000001', 'Chaleureux et familial', 'Agroalimentaire',
   'Familles 25-45 ans', array['instagram','facebook'], '12 posts / mois', '3 par semaine',
   array['Produit','Recette','Coulisses'], '11111111-1111-4111-8111-111111111111'),
  ('c1000000-0000-4000-8000-000000000002', 'Premium et rassurant', 'Immobilier',
   'Investisseurs 30-55 ans', array['instagram','linkedin'], '8 posts / mois', '2 par semaine',
   array['Bien','Conseil','Témoignage'], '11111111-1111-4111-8111-111111111111')
on conflict (client_id) do nothing;

insert into public.monthly_content_plans (id, client_id, month, year, theme, goals, status, created_by) values
  ('b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   8, 2026, 'Saveurs d''été', 'FABRICATED plan.', 'approved', '11111111-1111-4111-8111-111111111111'),
  ('b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002',
   8, 2026, 'Rentrée immobilière', 'FABRICATED plan.', 'draft', '11111111-1111-4111-8111-111111111111')
on conflict (client_id, month, year) do nothing;

insert into public.content_items
  (id, plan_id, client_id, title, content_type, platform, pillar, caption, publish_date, deadline, status, priority, assigned_to, created_by)
values
  -- Awaiting the client's decision: the one item the portal can act on.
  ('a1000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'Teaser gamme bio', 'post', 'instagram', 'Produit',
   'FABRICATED caption.', '2026-08-18', '2026-08-16', 'client_review', 'normal',
   '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),

  -- Belongs to Nova and is in a client-visible status. The Atlas contact must
  -- not reach it, and because the status is NOT what stops them, this fixture
  -- tests membership rather than the status filter.
  ('a1000000-0000-4000-8000-000000000002',
   'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002',
   'Visite guidée Lac 2', 'reel', 'instagram', 'Bien',
   'FABRICATED caption.', '2026-08-30', '2026-08-28', 'approved', 'normal',
   '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),

  ('a1000000-0000-4000-8000-000000000003',
   'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'Recette estivale — salade Atlas', 'reel', 'instagram', 'Recette',
   'FABRICATED caption.', '2026-08-14', '2026-08-12', 'approved', 'normal',
   '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),

  -- Atlas's own item, still in internal production. Visible to the agency,
  -- invisible in the portal: a client sees work once it is put in front of
  -- them, not while it is being made.
  ('a1000000-0000-4000-8000-000000000004',
   'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'Coulisses production', 'carousel', 'facebook', 'Coulisses',
   'FABRICATED caption.', '2026-08-21', '2026-08-19', 'design', 'high',
   '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),

  ('a1000000-0000-4000-8000-000000000005',
   'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002',
   'Nouveau bien — Lac 2', 'post', 'linkedin', 'Bien',
   'FABRICATED caption.', '2026-08-28', '2026-08-26', 'idea', 'normal',
   '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');

-- ═══ 6b. Video review ══════════════════════════════════════════════════════
-- No media is committed. `storage_path` points at a file that does not exist,
-- which is enough to exercise every permission boundary: what a role may read,
-- comment on and resolve is decided by these rows, not by the bytes.
--
-- Paths follow `<client_id>/<asset_id>/<file>` because the storage policy reads
-- the first segment back as the owning organisation.

insert into public.review_assets (id, client_id, content_item_id, title, status, created_by) values
  ('f1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'Teaser gamme bio — montage',
   'in_review', '22222222-2222-4222-8222-222222222222'),

  -- Nova's asset: the direct-object-reference target for the Atlas contact.
  ('f1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002',
   null, 'Visite Lac 2 — montage',
   'in_review', '22222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into public.review_versions
  (id, asset_id, version_number, storage_path, mime, size_bytes, duration_seconds, uploaded_by) values
  -- A superseded cut, so "comments only on the current version" has something
  -- to refuse.
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 1,
   'c1000000-0000-4000-8000-000000000001/f1000000-0000-4000-8000-000000000001/v1.mp4',
   'video/mp4', 10485760, 24.5, '22222222-2222-4222-8222-222222222222'),

  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 2,
   'c1000000-0000-4000-8000-000000000001/f1000000-0000-4000-8000-000000000001/v2.mp4',
   'video/mp4', 11534336, 25.0, '22222222-2222-4222-8222-222222222222'),

  ('f2000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000002', 1,
   'c1000000-0000-4000-8000-000000000002/f1000000-0000-4000-8000-000000000002/v1.mp4',
   'video/mp4', 9437184, 18.0, '22222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into public.review_comments
  (id, version_id, author_id, author_side, body, timecode_seconds) values
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002',
   '22222222-2222-4222-8222-222222222222', 'agency',
   'FABRICATED — première version envoyée pour retour.', null),
  ('f3000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000002',
   '77777777-7777-4777-8777-777777777777', 'client',
   'FABRICATED — le logo apparaît trop tôt.', 3.5)
on conflict do nothing;

-- ═══ 7. Publishing — finding #3 (past-dated, still "scheduled") ════════════
insert into public.social_posts
  (title, content, platforms, status, scheduled_at, project_id, task_id, created_by, hashtags, notes)
values
  ('Post Atlas — lancement', 'FABRICATED content.', array['instagram'], 'scheduled',
   '2026-06-25 09:00:00+01', 'e1000000-0000-4000-8000-000000000001', null,
   '11111111-1111-4111-8111-111111111111', '#atlas', 'Past-dated, still scheduled.'),
  ('Post Nova — visite', 'FABRICATED content.', array['facebook','instagram'], 'scheduled',
   '2026-06-30 17:30:00+01', 'e1000000-0000-4000-8000-000000000002', null,
   '11111111-1111-4111-8111-111111111111', '#nova', 'Past-dated, still scheduled.'),
  ('Post Zenith — promo', 'FABRICATED content.', array['instagram'], 'scheduled',
   '2026-07-02 12:00:00+01', 'e1000000-0000-4000-8000-000000000003', null,
   '11111111-1111-4111-8111-111111111111', '#zenith', 'Past-dated, still scheduled.'),
  ('Post Atlas — publié', 'FABRICATED content.', array['instagram'], 'published',
   '2026-08-05 10:00:00+01', 'e1000000-0000-4000-8000-000000000001', null,
   '11111111-1111-4111-8111-111111111111', '#atlas', 'Control: genuinely published.');

commit;

-- ── Summary ────────────────────────────────────────────────────────────────
do $$
declare
  n_clients int; n_devis int; n_items int;
begin
  select count(*) into n_clients from public.clients;
  select count(*) into n_devis   from public.devis;
  select count(*) into n_items   from public.content_items;
  raise notice 'Staging seed complete: % clients, % documents, % content items.',
    n_clients, n_devis, n_items;
  raise notice 'Sign in with admin / worker / freelancer  (password: staging-only-not-a-secret)';
  raise notice 'orphan@staging.local has NO profile and MUST be denied.';
end $$;
