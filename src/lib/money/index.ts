/**
 * Money — the centralised financial calculation module.
 *
 * Import from `@/lib/money` only. The builder preview, the persisting server
 * action, the print/PDF view and any future SQL generated column must all
 * derive their numbers from `computeDocumentTotals`, so the four copies of the
 * formula that exist today cannot drift apart again.
 *
 * NOTE: this module is not yet wired into the persistence path. See
 * `docs/audit/MONEY-COMPATIBILITY.md` for the divergences from the legacy
 * float formula and the migration plan awaiting approval.
 */

export {
  type Millimes,
  MILLIMES_PER_DT,
  MILLIMES_PER_CENTIME,
  ZERO,
  add,
  clamp,
  fromDt,
  isZero,
  max,
  millimes,
  multiplyByQuantity,
  multiplyByQuantityExact,
  percentOf,
  percentOfExact,
  quantizeToCentimes,
  roundHalfAwayFromZero,
  roundToCentimes,
  subtract,
  sum,
  toDt,
} from "./millimes";

export {
  type BalanceResult,
  type DiscountInput,
  type DocumentTotals,
  type DocumentTotalsDt,
  type FiscalStampInput,
  type LineItemInput,
  type PaymentInput,
  type PaymentStatus,
  type TotalsInput,
  type VatInput,
  CALCULATION_VERSION,
  DEFAULT_FISCAL_STAMP_DT,
  DEFAULT_VAT_RATE,
  SETTLEMENT_TOLERANCE,
  carryOverTaxConfiguration,
  computeBalance,
  computeDocumentTotals,
  toDtView,
} from "./totals";
