-- Phase 9 — optional TVA and the money shadow log.
--
-- Forward-only and value-preserving: no stored amount changes, no historical
-- document is recomputed, and both new defaults reproduce exactly what every
-- existing row already meant.

begin;

-- ═══ 1. The per-document TVA toggle ═════════════════════════════════════════
--
-- Explicit, never inferred. `tva_dt = 0` cannot be the signal — a zero can
-- mean an exempt client, a rounding artefact, or a document predating the
-- column. DEFAULT TRUE because every existing document was computed with TVA:
-- the backfill is a statement of historical fact, not a policy choice.
--
-- The rate column already exists (numeric(5,2), default 19.00). When the
-- toggle is off the rate is retained on the row for the record but contributes
-- nothing — "what rate WOULD have applied" remains answerable.
alter table public.devis
  add column if not exists tva_enabled boolean not null default true;

comment on column public.devis.tva_enabled is
  'Per-document TVA toggle. Explicit choice, changeable while the document is a draft; rate is retained but inert when false.';

-- ═══ 2. The calculation snapshot marker ═════════════════════════════════════
--
-- Names which engine produced the stored totals. Every historical and current
-- row is 'legacy-v1' (float + toFixed). When the millimes engine is approved
-- for production, new finalised documents will stamp 'millimes-v2' — and the
-- ledger of which document was computed how survives the transition, which is
-- what makes "never recompute historical documents" auditable rather than
-- aspirational.
alter table public.devis
  add column if not exists calc_source text not null default 'legacy-v1'
  check (calc_source in ('legacy-v1', 'millimes-v2'));

-- ═══ 3. Immutability of issued documents, enforced where it cannot drift ════
--
-- The application already refuses to recompute a non-draft document; this
-- trigger makes the same rule hold for a write that never passes through the
-- application. Financial columns freeze the moment a document leaves draft.
-- The escape hatch is explicit and audit-visible: set the status back to
-- 'draft', edit, re-issue. Status and payment_status stay mutable — moving a
-- document through its lifecycle is not editing its arithmetic.
create or replace function public.guard_issued_devis()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status <> 'draft' and new.status = old.status then
    if new.subtotal_dt is distinct from old.subtotal_dt
       or new.discount_dt is distinct from old.discount_dt
       or new.tva_rate    is distinct from old.tva_rate
       or new.tva_enabled is distinct from old.tva_enabled
       or new.tva_dt      is distinct from old.tva_dt
       or new.stamp_dt    is distinct from old.stamp_dt
       or new.total_dt    is distinct from old.total_dt
       or new.calc_source is distinct from old.calc_source then
      raise exception
        'Financial columns are frozen on an issued document. Return it to draft first.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_devis_issued_guard on public.devis;
create trigger trg_devis_issued_guard
  before update on public.devis
  for each row
  execute function public.guard_issued_devis();

-- ═══ 4. The money shadow log ════════════════════════════════════════════════
--
-- Every draft calculation is run through BOTH engines — the legacy float
-- arithmetic that persists, and the gated integer-millimes engine that does
-- not — and any disagreement lands here. This is how the documented 0.9%
-- divergence stops being a one-off study and becomes a living measurement,
-- without the new engine ever touching a stored amount.
--
-- Deliberately structural, never sensitive: no client, no document totals, no
-- object text. The divergence in millimes, the inputs' shape, and the rate.
-- Enough to know how often and how large; nothing to leak.
create table if not exists public.money_shadow_log (
  id                  bigint generated always as identity primary key,
  kind                text not null,
  item_count          integer not null,
  tva_enabled         boolean not null,
  tva_rate            numeric(5,2) not null,
  stamp_applied       boolean not null,
  divergence_millimes integer not null,
  created_at          timestamptz not null default now()
);

comment on table public.money_shadow_log is
  'Divergences between the persisted legacy calculation and the gated millimes engine. Structural data only — no amounts, no clients, no document references.';

alter table public.money_shadow_log enable row level security;

-- Admin reads the measurement; inserts come from the internal roles whose
-- draft edits produce them. Append-only: no update or delete policy exists.
drop policy if exists "money_shadow_admin_select" on public.money_shadow_log;
create policy "money_shadow_admin_select" on public.money_shadow_log
  for select using (public.is_admin());

drop policy if exists "money_shadow_insert_internal" on public.money_shadow_log;
create policy "money_shadow_insert_internal" on public.money_shadow_log
  for insert with check (public.auth_role() in ('admin', 'commercial'));

commit;
