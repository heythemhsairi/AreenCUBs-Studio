-- ============================================================
-- Finance OS v2 Migration
-- ============================================================
-- Adds: expenses table, devis invoice status computed view,
--       client balance view, Finance OS v2 update notification
-- ============================================================

-- ---- 1. Expenses table ----------------------------------------
create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  category       text not null default 'other',
  amount_dt      numeric(10,2) not null check (amount_dt >= 0),
  expense_date   date not null default current_date,
  project_id     uuid references public.projects(id) on delete set null,
  client_id      uuid references public.clients(id) on delete set null,
  vendor         text,
  payment_method text,
  receipt_url    text,
  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists expenses_date_idx     on public.expenses(expense_date);
create index if not exists expenses_category_idx on public.expenses(category);
create index if not exists expenses_project_idx  on public.expenses(project_id);
create index if not exists expenses_client_idx   on public.expenses(client_id);

-- updated_at trigger
drop trigger if exists trg_expenses_updated on public.expenses;
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---- 2. RLS for expenses --------------------------------------
alter table public.expenses enable row level security;

-- Admin: full access
drop policy if exists "admin_all_expenses" on public.expenses;
create policy "admin_all_expenses" on public.expenses
  for all using (is_admin()) with check (is_admin());

-- Workers: read-only
drop policy if exists "worker_read_expenses" on public.expenses;
create policy "worker_read_expenses" on public.expenses
  for select using (is_worker_or_admin());

-- ---- 3. Migrate existing paid factures → ensure payments exist --
-- For every facture with payment_status='paid' that has no payment row,
-- create one synthetic payment using updated_at as the date.
insert into public.payments (devis_id, amount_dt, paid_at, method, notes, recorded_by)
select
  d.id,
  d.total_dt,
  coalesce(d.updated_at::date, d.date),
  'migré depuis ancien système',
  'Paiement créé automatiquement lors de la migration Finance OS v2',
  d.created_by
from public.devis d
where d.kind = 'facture'
  and d.payment_status = 'paid'
  and not exists (
    select 1 from public.payments p where p.devis_id = d.id
  )
  and d.total_dt > 0;

-- For partially-paid factures that have no payment row, skip
-- (partial means some payment should already exist)

-- ---- 4. Finance OS v2 update notification ----------------------
-- Insert only if not already present (idempotent)
do $$
declare
  v_update_id uuid;
begin
  -- Check if this version already seeded
  select id into v_update_id
  from public.app_updates
  where version = '2.0.0'
  limit 1;

  if v_update_id is null then
    insert into public.app_updates (version, title, summary, active, released_at)
    values (
      '2.0.0',
      'Finance OS v2',
      'Finances reconstruites : factures propres, paiements réels, dépenses, profit net, profil client et suivi intelligent.',
      true,
      now()
    )
    returning id into v_update_id;

    -- Désactiver les anciennes notifications
    update public.app_updates set active = false
    where version != '2.0.0';

    -- Items globaux
    insert into public.app_update_items (update_id, title, body, role, section, sort_order) values
    (v_update_id, 'Dashboard refait de zéro', 'KPIs corrects : encaissé = paiements réels, facturé = factures uniquement, impayés = solde factures non réglées.', null, null, 1),
    (v_update_id, 'Suivi des paiements', 'Paiements partiels supportés. Chaque paiement est horodaté et traçable.', null, null, 2),
    (v_update_id, 'Dépenses & profit net', 'Saisissez vos dépenses par catégorie. Profit = encaissé − dépenses.', null, null, 3),
    (v_update_id, 'Pipeline Devis', 'Taux de conversion, CA espéré, CA perdu. Les devis acceptés ne comptent plus comme facturés.', null, null, 4),
    (v_update_id, 'Profil financier client', 'Solde impayé, retard moyen, niveau de risque (Bon / En retard / Risqué) par client.', null, null, 5),
    -- Admin-only items
    (v_update_id, 'Export & relances avancées', 'Actions rapides : convertir devis → facture, ajouter paiement, créer tâche relance, marquer contacté.', 'admin', 'finance', 6),
    (v_update_id, 'Suivi des factures overdue', 'Tableau des factures en retard avec vieillissement (0-30j, 31-60j, 60j+) et actions directes.', 'admin', 'finance', 7);
  end if;
end $$;
