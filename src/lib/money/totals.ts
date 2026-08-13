/**
 * Document totals — the single source of truth for quote and invoice money.
 *
 * The same formula currently exists in four places (the builder's live preview,
 * the server action that persists, the print/PDF view, and a SQL heal
 * migration). This module is the one they must all delegate to so they cannot
 * drift apart.
 *
 * ── Calculation order (business rule — do not reorder) ───────────────────────
 *   1. Line total  = unit price × quantity, per line. Bonus lines are free.
 *   2. Subtotal    = Σ line totals (HT).
 *   3. Discount    = fixed amount or percentage of subtotal; never exceeds it.
 *   4. Net         = subtotal − discount.
 *   5. VAT         = net × rate, only when VAT is enabled on this document.
 *   6. Stamp       = fixed fiscal stamp, added after VAT and itself untaxed.
 *   7. Total TTC   = net + VAT + stamp.
 *
 * Every amount is rounded to centimes at its own step, so each line of the
 * printed document is internally consistent and the components genuinely add
 * up to the total shown.
 *
 * ── Calculation version ──────────────────────────────────────────────────────
 * Documents record which revision of these rules produced their stored numbers.
 * A future rule change must increment CALCULATION_VERSION and leave historical
 * documents recomputing under the version they were issued with, so a past
 * invoice never silently changes value.
 */

import {
  type Millimes,
  ZERO,
  add,
  clamp,
  fromDt,
  max,
  millimes,
  multiplyByQuantityExact,
  percentOfExact,
  quantizeToCentimes,
  subtract,
  sum,
  toDt,
} from "./millimes";

/** Identifies the rule-set that produced a document's stored amounts. */
export const CALCULATION_VERSION = 1;

/** Standard Tunisian VAT rate, as a percentage. */
export const DEFAULT_VAT_RATE = 19;

/** Statutory fiscal stamp (timbre fiscal) in DT at the time of writing. */
export const DEFAULT_FISCAL_STAMP_DT = 1;

/**
 * Tolerance for treating a balance as settled, in millimes (10 = 0.01 DT).
 *
 * A single approved constant, replacing the `0.01` literals scattered through
 * `src/lib/finance.ts`. Any change here is a business decision.
 */
export const SETTLEMENT_TOLERANCE: Millimes = millimes(10);

// ── Input types ──────────────────────────────────────────────────────────────

export type LineItemInput = {
  quantity: number;
  unitPriceDt: number;
  /** Bonus lines appear on the document but contribute nothing to the total. */
  isBonus?: boolean;
};

export type DiscountInput =
  | { type: "none" }
  | { type: "amount"; valueDt: number }
  | { type: "percent"; value: number };

export type VatInput = {
  /** Per-document VAT switch. Stored as a snapshot on the document. */
  enabled: boolean;
  /** Percentage, e.g. 19. Ignored when disabled. */
  ratePercent: number;
};

export type FiscalStampInput = {
  enabled: boolean;
  /** Charged amount is stored, not just a flag, so past documents survive a rate change. */
  amountDt: number;
};

export type TotalsInput = {
  items: readonly LineItemInput[];
  discount?: DiscountInput;
  vat?: VatInput;
  fiscalStamp?: FiscalStampInput;
};

// ── Output types ─────────────────────────────────────────────────────────────

export type DocumentTotals = {
  /** Per-line totals, index-aligned with the input items. */
  lineTotals: readonly Millimes[];
  subtotal: Millimes;
  discountAmount: Millimes;
  /** Subtotal − discount. The VAT base. */
  net: Millimes;
  vatAmount: Millimes;
  vatRateApplied: number;
  stampAmount: Millimes;
  total: Millimes;
  calculationVersion: number;
};

/** The same figures as DT numbers, for display and for the existing columns. */
export type DocumentTotalsDt = {
  lineTotals: number[];
  subtotalDt: number;
  discountDt: number;
  netDt: number;
  tvaDt: number;
  tvaRate: number;
  stampDt: number;
  totalDt: number;
  calculationVersion: number;
};

// ── Core ─────────────────────────────────────────────────────────────────────

/**
 * Computes every monetary component of a quote or invoice.
 *
 * Pure and total: no clock, no locale, no I/O, and no input shape can make it
 * throw. Identical inputs always produce identical outputs, which is what makes
 * it safe to run in the browser preview and on the server and expect a match.
 */
export function computeDocumentTotals(input: TotalsInput): DocumentTotals {
  const vat = input.vat ?? { enabled: false, ratePercent: 0 };
  const stamp = input.fiscalStamp ?? { enabled: false, amountDt: 0 };
  const discount = input.discount ?? { type: "none" };

  // 1. Line totals. A bonus line is free regardless of the price shown on it —
  //    this is intrinsic to the formula rather than relying on a caller having
  //    zeroed the unit price beforehand.
  //
  //    Each line is quantized ONCE, from the exact product. Rounding to
  //    millimes first and to centimes second would double-round; see the
  //    warning in millimes.ts.
  const lineTotals = input.items.map((item) => {
    if (item.isBonus) return ZERO;
    const unit = fromDt(item.unitPriceDt);
    const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
    if (qty <= 0) return ZERO;
    return quantizeToCentimes(multiplyByQuantityExact(unit, qty));
  });

  // 2. Subtotal from the already-quantized line totals, so the printed lines
  //    provably add up to the printed subtotal.
  const subtotal = sum(lineTotals);

  // 3. Discount, never negative and never more than the subtotal.
  const rawDiscount =
    discount.type === "amount"
      ? fromDt(discount.valueDt)
      : discount.type === "percent"
        ? quantizeToCentimes(percentOfExact(subtotal, discount.value))
        : ZERO;
  const discountAmount = clamp(quantizeToCentimes(rawDiscount), ZERO, subtotal);

  // 4. Net.
  const net = subtract(subtotal, discountAmount);

  // 5. VAT on the net, only when enabled on this document. Single quantization
  //    from the exact percentage.
  const vatRateApplied = vat.enabled && Number.isFinite(vat.ratePercent) ? vat.ratePercent : 0;
  const vatAmount = vat.enabled
    ? quantizeToCentimes(percentOfExact(net, vatRateApplied))
    : ZERO;

  // 6. Stamp, after VAT and untaxed.
  const stampAmount = stamp.enabled ? quantizeToCentimes(max(fromDt(stamp.amountDt), ZERO)) : ZERO;

  // 7. Total. Components are already centime-aligned, so this is exact.
  const total = add(add(net, vatAmount), stampAmount);

  return {
    lineTotals,
    subtotal,
    discountAmount,
    net,
    vatAmount,
    vatRateApplied,
    stampAmount,
    total,
    calculationVersion: CALCULATION_VERSION,
  };
}

/** Presents totals as DT numbers for the UI and the existing numeric(10,2) columns. */
export function toDtView(totals: DocumentTotals): DocumentTotalsDt {
  return {
    lineTotals: totals.lineTotals.map(toDt),
    subtotalDt: toDt(totals.subtotal),
    discountDt: toDt(totals.discountAmount),
    netDt: toDt(totals.net),
    tvaDt: toDt(totals.vatAmount),
    tvaRate: totals.vatRateApplied,
    stampDt: toDt(totals.stampAmount),
    totalDt: toDt(totals.total),
    calculationVersion: totals.calculationVersion,
  };
}

// ── Payments and balance ─────────────────────────────────────────────────────

export type PaymentInput = { amountDt: number };

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid";

export type BalanceResult = {
  totalDue: Millimes;
  amountPaid: Millimes;
  /** Never negative; an overpayment reports zero balance and status `overpaid`. */
  balanceDue: Millimes;
  status: PaymentStatus;
  isSettled: boolean;
};

/**
 * Derives payment state from money actually received.
 *
 * This is the fix for audit finding #5: payment status must be *computed* from
 * payments and the remaining balance, never stored independently where it can
 * contradict them. A document cannot be "paid" with an outstanding balance,
 * because the two are no longer separate facts.
 */
export function computeBalance(
  totalDue: Millimes,
  payments: readonly PaymentInput[],
): BalanceResult {
  const amountPaid = sum(payments.map((p) => quantizeToCentimes(fromDt(p.amountDt))));
  const rawBalance = subtract(totalDue, amountPaid);
  const balanceDue = max(rawBalance, ZERO);
  const isSettled = rawBalance <= SETTLEMENT_TOLERANCE;

  let status: PaymentStatus;
  if (rawBalance < -SETTLEMENT_TOLERANCE) status = "overpaid";
  else if (isSettled) status = "paid";
  else if (amountPaid > 0) status = "partial";
  else status = "unpaid";

  return { totalDue, amountPaid, balanceDue, status, isSettled };
}

/**
 * Copies a quote's tax configuration onto the invoice it becomes.
 *
 * Conversion must carry the quote's VAT and stamp snapshot rather than
 * re-reading current company defaults, otherwise accepting an old quote can
 * change what the client is charged.
 */
export function carryOverTaxConfiguration(source: {
  vat: VatInput;
  fiscalStamp: FiscalStampInput;
}): { vat: VatInput; fiscalStamp: FiscalStampInput } {
  return {
    vat: { enabled: source.vat.enabled, ratePercent: source.vat.ratePercent },
    fiscalStamp: {
      enabled: source.fiscalStamp.enabled,
      amountDt: source.fiscalStamp.amountDt,
    },
  };
}
