-- ============================================================
-- Finance Payment Integrity Migration
-- ============================================================
-- Problem: converting a devis to facture left payments linked to
-- the devis.id only. The facture had no payments → showed 0 paid.
-- Users could then record a SECOND payment on the facture, double-
-- counting the same money.
--
-- Fix:
-- 1. Add source_devis_id + source_payment_id audit columns to payments.
-- 2. Add migrated_from_devis boolean flag.
-- 3. Add unique guard: cannot have two payments on the same invoice
--    originating from the same source payment row.
-- 4. Relink existing devis payments to their linked factures (safe copy).
-- 5. Recompute facture payment_status from actual linked payments.
-- ============================================================

-- ---- 1. Extend payments table -----------------------------------
alter table public.payments
  add column if not exists source_devis_id    uuid references public.devis(id) on delete set null,
  add column if not exists source_payment_id  uuid references public.payments(id) on delete set null,
  add column if not exists migrated_from_devis boolean not null default false;

-- Prevent double-relinking the same source payment to the same facture
create unique index if not exists payments_source_dedup_uk
  on public.payments (devis_id, source_payment_id)
  where source_payment_id is not null;

-- ---- 2. Relink existing devis payments to their factures ---------
-- For each facture (kind='facture') that has a parent_devis_id:
--   • Find payments on the parent devis
--   • Copy them to the facture IF no matching payment already exists
--   • Mark original devis payments with source_devis_id pointing to themselves
--     so we know to exclude them from double-counting
do $$
declare
  rec         record;
  src_pay     record;
  already     boolean;
begin
  for rec in
    select f.id as facture_id, f.parent_devis_id, f.total_dt
    from public.devis f
    where f.kind = 'facture'
      and f.parent_devis_id is not null
  loop
    for src_pay in
      select * from public.payments p
      where p.devis_id = rec.parent_devis_id
    loop
      -- Check if a payment already exists on this facture with same source
      select exists(
        select 1 from public.payments x
        where x.devis_id = rec.facture_id
          and (
            x.source_payment_id = src_pay.id
            or (
              abs(x.amount_dt - src_pay.amount_dt) < 0.01
              and x.paid_at = src_pay.paid_at
              and x.migrated_from_devis = true
            )
          )
      ) into already;

      if not already then
        insert into public.payments (
          devis_id, amount_dt, paid_at, method, notes,
          recorded_by, source_devis_id, source_payment_id,
          migrated_from_devis, created_at
        ) values (
          rec.facture_id,
          src_pay.amount_dt,
          src_pay.paid_at,
          coalesce(src_pay.method, 'migré depuis devis'),
          coalesce(src_pay.notes, 'Paiement transféré depuis ' || rec.parent_devis_id::text),
          src_pay.recorded_by,
          rec.parent_devis_id,
          src_pay.id,
          true,
          src_pay.created_at
        );
      end if;
    end loop;

    -- Recompute facture payment_status from its now-complete payment set
    declare
      paid_sum numeric;
      new_status text;
    begin
      select coalesce(sum(amount_dt), 0) into paid_sum
      from public.payments
      where devis_id = rec.facture_id;

      if paid_sum <= 0 then
        new_status := 'unpaid';
      elsif paid_sum + 0.01 < rec.total_dt then
        new_status := 'partial';
      else
        new_status := 'paid';
      end if;

      update public.devis
      set payment_status = new_status::payment_status
      where id = rec.facture_id;
    end;
  end loop;
end $$;

-- ---- 3. Mark original devis-level payments so the dashboard can
--         exclude them when a facture already holds their value.
-- A devis payment is "superseded" when the linked facture has a
-- migrated copy of it. We mark it with source_devis_id = its own devis id.
update public.payments p
set source_devis_id = p.devis_id
where p.migrated_from_devis = false
  and p.source_devis_id is null
  and exists (
    select 1 from public.devis d
    where d.id = p.devis_id
      and d.kind = 'devis'
      and exists (
        select 1 from public.devis f
        where f.parent_devis_id = d.id
          and f.kind = 'facture'
      )
  );
-- The above marks every devis payment that has a facture child.
-- The finance queries will filter: count only payments where
-- (source_devis_id is null) OR (the devis.kind = 'facture')
-- which naturally excludes double-counted devis payments.

-- ---- 4. Index for efficient finance queries ----------------------
create index if not exists payments_migrated_idx on public.payments(migrated_from_devis);
create index if not exists payments_source_devis_idx on public.payments(source_devis_id);
