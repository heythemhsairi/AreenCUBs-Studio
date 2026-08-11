/**
 * THE calculation for quote and invoice totals — the only one.
 *
 * Until this file existed the math lived twice: once in the devis server
 * actions and once, line for line, in the builder's preview. Two copies of a
 * financial rule is one rule and one future bug — the moment someone edits the
 * TVA handling in one place, the preview shows a client a number the server
 * will not store. Preview, server validation and stored totals now all call
 * this function; the print view renders stored values, which these produced.
 *
 * ── Deliberately the LEGACY arithmetic ──────────────────────────────────────
 * Float + toFixed(2), exactly as the application has always computed. The
 * integer-millimes engine in `millimes.ts` / `totals.ts` produces different
 * results on 54 historical documents (a documented 0.9% divergence, all
 * traceable to the old rounding), and activating it is APPROVAL-GATED. This
 * function is bug-compatible on purpose; `shadow.ts` compares the two engines
 * without letting the new one near anything persisted.
 *
 * ── Optional TVA ────────────────────────────────────────────────────────────
 * `tvaEnabled` is an explicit per-document choice, not an inference. Off, the
 * rate is retained on the row for the record but contributes zero. The fiscal
 * stamp is a separate flag entirely — a fixed fee, not a tax, and never part
 * of the TVA base.
 */

/** Tunisian standard rate, the default for new documents. */
export const DEFAULT_TVA_RATE = 19;

/** Fiscal stamp (timbre fiscal), fixed, in dinars. */
export const STAMP_DT = 1.0;

export type CalcLine = {
  quantity: number;
  unit_price_dt: number;
  /** Bonus lines are shown priced but contribute nothing. */
  is_bonus?: boolean;
};

export type CalcOptions = {
  /** The per-document toggle. */
  tvaEnabled: boolean;
  /** Percentage, e.g. 19. Retained but inert when tvaEnabled is false. */
  tvaRate: number;
  applyStamp: boolean;
  discountDt?: number;
};

export type DocumentTotals = {
  subtotal: number;
  discount: number;
  /** Subtotal minus discount — the TVA base. */
  net: number;
  tva: number;
  stamp: number;
  total: number;
};

/** A rate a document may legally carry: 0–100, at most two decimals. */
export function isValidTvaRate(rate: number): boolean {
  return (
    Number.isFinite(rate) && rate >= 0 && rate <= 100 && Math.round(rate * 100) === rate * 100
  );
}

export function computeDocumentTotalsLegacy(
  lines: CalcLine[],
  options: CalcOptions,
): DocumentTotals {
  const subtotal = lines.reduce(
    (sum, line) => (line.is_bonus ? sum : sum + line.quantity * line.unit_price_dt),
    0,
  );
  const discount = Math.max(0, Math.min(subtotal, options.discountDt ?? 0));
  const net = subtotal - discount;
  const tva = options.tvaEnabled ? +((net * options.tvaRate) / 100).toFixed(2) : 0;
  const stamp = options.applyStamp ? STAMP_DT : 0;
  const total = +(net + tva + stamp).toFixed(2);
  return {
    subtotal: +subtotal.toFixed(2),
    discount: +discount.toFixed(2),
    net: +net.toFixed(2),
    tva,
    stamp: +stamp.toFixed(2),
    total,
  };
}
