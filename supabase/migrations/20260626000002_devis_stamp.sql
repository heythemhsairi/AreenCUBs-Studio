-- Areen CUBs Studio — Fiscal stamp (timbre fiscal) on devis/factures
-- Adds a stamp_dt column holding the fixed fiscal-stamp fee applied to a
-- document. Stored as the amount (not a boolean) so the exact charged value is
-- preserved even if the legal rate changes later. "Applied" == stamp_dt > 0.
-- The stamp is added on top of the TVA-inclusive total and is itself untaxed,
-- so total_dt already includes it; subtotal_dt / tva_dt are unchanged.
-- Non-destructive: existing rows default to 0 (no stamp), preserving their
-- current total_dt.

alter table public.devis
  add column if not exists stamp_dt numeric(10,2) not null default 0;
