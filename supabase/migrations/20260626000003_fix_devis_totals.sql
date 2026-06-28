-- Areen CUBs Studio — Heal devis/facture totals so total_dt is internally
-- consistent with its own stored components.
--
-- Background: some documents were saved before the fiscal-stamp column existed
-- (or before the stamp math was final). On those rows total_dt can disagree
-- with subtotal_dt − discount_dt + tva_dt + stamp_dt by the 1 DT stamp,
-- producing a mismatch between the builder preview and the printed total.
--
-- This recomputes total_dt purely from the columns already on the row, so no
-- new money is invented — it only realigns total_dt with the line items / TVA /
-- discount / stamp that are already stored. Idempotent: rows that are already
-- consistent are left unchanged by the WHERE guard.

update public.devis
  set total_dt = round(
        coalesce(subtotal_dt, 0)
      - coalesce(discount_dt, 0)
      + coalesce(tva_dt, 0)
      + coalesce(stamp_dt, 0)
      , 2)
  where total_dt is distinct from round(
        coalesce(subtotal_dt, 0)
      - coalesce(discount_dt, 0)
      + coalesce(tva_dt, 0)
      + coalesce(stamp_dt, 0)
      , 2);
