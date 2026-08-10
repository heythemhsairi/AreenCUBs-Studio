/**
 * Integer money primitives.
 *
 * ── Why integers ─────────────────────────────────────────────────────────────
 * The legacy formula computes money as IEEE-754 doubles and rounds with
 * `+(x).toFixed(2)`. That is unsafe for stored money in two distinct ways:
 *
 *   1. Accumulated representation error — `0.1 + 0.2 === 0.30000000000000004`.
 *   2. `toFixed` rounds the *binary* value, not the decimal one the user typed.
 *      `(1.005).toFixed(2) === "1.00"` because 1.005 is stored as
 *      1.00499999999999989…, so the "round half up" the business expects
 *      silently becomes "round down" at unpredictable inputs.
 *
 * Everything here therefore works in **millimes** — integer thousandths of a
 * Tunisian dinar, the country's real minor unit (1 DT = 1000 millimes).
 * Conversion to a floating-point DT value happens only at the display boundary.
 *
 * ── Millimes vs. the 2-decimal display ───────────────────────────────────────
 * The database currently stores `numeric(10,2)` and the UI shows 2 decimals.
 * Millimes give one extra digit of internal headroom, so intermediate results
 * (notably VAT) never lose precision before the final documented rounding to
 * centimes. Document-level amounts are rounded to centimes so they remain
 * exactly representable in the existing columns.
 */

/**
 * An integer count of millimes (1/1000 DT).
 *
 * Branded so a raw DT float cannot be passed where millimes are expected —
 * the single most likely way this module could be silently misused.
 */
export type Millimes = number & { readonly __brand: "Millimes" };

/** Millimes per dinar. */
export const MILLIMES_PER_DT = 1000;

/** Millimes per centime (1/100 DT) — the precision the database stores. */
export const MILLIMES_PER_CENTIME = 10;

/**
 * Rounds half away from zero — the convention Tunisian invoicing expects, and
 * the one a human means by "round to the nearest".
 *
 * `Math.round` alone is wrong for negative values: it rounds toward +∞, so
 * `Math.round(-0.5) === -0`, turning a −0.5 credit into 0 instead of −1.
 */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Asserts and brands an integer millime count. */
export function millimes(value: number): Millimes {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Millimes must be finite, received ${value}`);
  }
  if (!Number.isInteger(value)) {
    throw new RangeError(`Millimes must be an integer, received ${value}`);
  }
  return value as Millimes;
}

/** Zero, as millimes. */
export const ZERO = millimes(0);

/**
 * Converts a DT amount (as typed by a user or read from the database) into
 * millimes, rounding to the nearest millime.
 *
 * Non-finite input yields zero rather than throwing: form fields and legacy
 * rows can contain `NaN`, and a quote must never fail to render because of one
 * bad cell.
 */
export function fromDt(dt: number): Millimes {
  if (!Number.isFinite(dt)) return ZERO;
  return millimes(roundHalfAwayFromZero(dt * MILLIMES_PER_DT));
}

/**
 * Converts millimes back to a DT number for display or for writing to the
 * existing `numeric(10,2)` columns.
 */
export function toDt(value: Millimes): number {
  return value / MILLIMES_PER_DT;
}

/**
 * Rounds millimes to whole centimes (2 decimal places).
 *
 * Applied at documented boundaries only — VAT, discounts, line totals and the
 * grand total — so that every persisted amount is exactly representable in
 * `numeric(10,2)` and the printed PDF can never disagree with the database.
 */
export function roundToCentimes(value: Millimes): Millimes {
  return millimes(
    roundHalfAwayFromZero(value / MILLIMES_PER_CENTIME) * MILLIMES_PER_CENTIME,
  );
}

// ── Arithmetic ───────────────────────────────────────────────────────────────
// Thin wrappers, but they keep the brand intact and make the call sites read
// as money rather than as arbitrary numbers.

export function add(a: Millimes, b: Millimes): Millimes {
  return millimes(a + b);
}

export function subtract(a: Millimes, b: Millimes): Millimes {
  return millimes(a - b);
}

export function sum(values: readonly Millimes[]): Millimes {
  return millimes(values.reduce<number>((acc, v) => acc + v, 0));
}

/**
 * Multiplies millimes by a dimensionless quantity.
 *
 * The quantity may legitimately be fractional (e.g. 1.5 days of work), so the
 * product is rounded to the nearest millime rather than assumed integral.
 */
export function multiplyByQuantity(value: Millimes, quantity: number): Millimes {
  if (!Number.isFinite(quantity)) return ZERO;
  return millimes(roundHalfAwayFromZero(value * quantity));
}

/**
 * Applies a percentage, rounding to the nearest millime.
 * Used for VAT and percentage discounts.
 */
export function percentOf(value: Millimes, percent: number): Millimes {
  if (!Number.isFinite(percent)) return ZERO;
  return millimes(roundHalfAwayFromZero((value * percent) / 100));
}

// ── Exact intermediates and single-step quantization ─────────────────────────
//
// ⚠ Double rounding is a real defect, not a rounding-style preference.
// Rounding an exact result to millimes and then rounding that to centimes
// gives the wrong answer whenever the exact value lies just below a millime
// midpoint: 0.02470 → 0.025 (millimes) → 0.03 (centimes), where a single
// correct rounding to 2 decimals gives 0.02. This was caught by the
// legacy-equivalence sweep at a 5.25% divergence rate.
//
// The functions below therefore keep intermediate results EXACT (as unrounded
// fractional millimes) and expose one quantization step. Document code must
// use these, never the rounded pair above followed by roundToCentimes.

/** Unrounded product, in fractional millimes. */
export function multiplyByQuantityExact(value: Millimes, quantity: number): number {
  if (!Number.isFinite(quantity)) return 0;
  return value * quantity;
}

/** Unrounded percentage, in fractional millimes. */
export function percentOfExact(value: number, percent: number): number {
  if (!Number.isFinite(percent) || !Number.isFinite(value)) return 0;
  return (value * percent) / 100;
}

/**
 * Rounds an exact fractional-millime value to whole centimes in a SINGLE step.
 * This is the only sanctioned way to turn an intermediate into a stored amount.
 */
export function quantizeToCentimes(exactMillimes: number): Millimes {
  if (!Number.isFinite(exactMillimes)) return ZERO;
  return millimes(
    roundHalfAwayFromZero(exactMillimes / MILLIMES_PER_CENTIME) * MILLIMES_PER_CENTIME,
  );
}

/** Clamps to the inclusive range [min, max]. */
export function clamp(value: Millimes, min: Millimes, max: Millimes): Millimes {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function isZero(value: Millimes): boolean {
  return value === 0;
}

export function max(a: Millimes, b: Millimes): Millimes {
  return a > b ? a : b;
}
