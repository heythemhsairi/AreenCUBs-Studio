import { describe, it, expect } from "vitest";
import { computeDocumentTotals, toDtView } from "./totals";

/**
 * Legacy-equivalence proof.
 *
 * Before the money module can replace the four hand-written copies of the
 * formula, we must know exactly where the new implementation agrees with the
 * one currently in production and where it does not. Divergence is not
 * automatically a bug — the new implementation is deliberately more correct —
 * but every divergence must be *known* and approved before persistence
 * changes, because it moves numbers on real documents.
 *
 * The function below is a verbatim transcription of the production formula in
 * `src/app/dashboard/devis/actions.ts:108-125` (which the client preview in
 * `devis-builder.tsx:148-166` mirrors line for line).
 */
function legacyComputeTotals(
  items: { quantity: number; unit_price_dt: number }[],
  discountDt = 0,
  applyStamp = false,
  tvaRate = 19,
  stampDt = 1,
) {
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price_dt, 0);
  const discount = Math.max(0, Math.min(subtotal, discountDt));
  const net = subtotal - discount;
  const tva = +((net * tvaRate) / 100).toFixed(2);
  const stamp = applyStamp ? stampDt : 0;
  const total = +(net + tva + stamp).toFixed(2);
  return {
    subtotal: +subtotal.toFixed(2),
    discount: +discount.toFixed(2),
    tva,
    stamp: +stamp.toFixed(2),
    total,
  };
}

function modern(
  items: { quantity: number; unit_price_dt: number }[],
  discountDt = 0,
  applyStamp = false,
) {
  return toDtView(
    computeDocumentTotals({
      items: items.map((i) => ({ quantity: i.quantity, unitPriceDt: i.unit_price_dt })),
      discount: { type: "amount", valueDt: discountDt },
      vat: { enabled: true, ratePercent: 19 },
      fiscalStamp: { enabled: applyStamp, amountDt: 1 },
    }),
  );
}

/** Representative real-world documents: whole prices, common agency amounts. */
const REALISTIC_CASES: {
  name: string;
  items: { quantity: number; unit_price_dt: number }[];
  discount: number;
  stamp: boolean;
}[] = [
  { name: "single whole-dinar service", items: [{ quantity: 1, unit_price_dt: 1500 }], discount: 0, stamp: true },
  { name: "multi-line retainer", items: [{ quantity: 1, unit_price_dt: 800 }, { quantity: 3, unit_price_dt: 250 }], discount: 0, stamp: true },
  { name: "with fixed discount", items: [{ quantity: 1, unit_price_dt: 2000 }], discount: 150, stamp: true },
  { name: "no stamp", items: [{ quantity: 2, unit_price_dt: 425 }], discount: 0, stamp: false },
  { name: "two-decimal prices", items: [{ quantity: 4, unit_price_dt: 137.5 }], discount: 25.5, stamp: true },
  { name: "empty document", items: [], discount: 0, stamp: false },
  { name: "discount exceeding subtotal", items: [{ quantity: 1, unit_price_dt: 100 }], discount: 999, stamp: true },
  { name: "large document", items: [{ quantity: 12, unit_price_dt: 1875.25 }], discount: 500, stamp: true },
];

describe("legacy equivalence — realistic documents", () => {
  it.each(REALISTIC_CASES)("matches production on: $name", ({ items, discount, stamp }) => {
    const legacy = legacyComputeTotals(items, discount, stamp);
    const next = modern(items, discount, stamp);

    expect(next.subtotalDt).toBeCloseTo(legacy.subtotal, 2);
    expect(next.discountDt).toBeCloseTo(legacy.discount, 2);
    expect(next.tvaDt).toBeCloseTo(legacy.tva, 2);
    expect(next.stampDt).toBeCloseTo(legacy.stamp, 2);
    expect(next.totalDt).toBeCloseTo(legacy.total, 2);
  });
});

describe("legacy equivalence — systematic sweep", () => {
  /**
   * Sweeps a wide grid of quantities and prices and records every input where
   * the two implementations disagree on the grand total. The assertion is on
   * the *rate* of divergence: this test is a measurement instrument, and its
   * output is the input to the compatibility plan.
   */
  it("quantifies divergence across a 2-decimal price grid", () => {
    const divergences: { qty: number; price: number; legacy: number; next: number }[] = [];
    let compared = 0;

    for (let qty = 1; qty <= 12; qty++) {
      for (let cents = 1; cents <= 500; cents++) {
        const price = Math.round(cents * 7.13) / 100; // spread across the range
        const items = [{ quantity: qty, unit_price_dt: price }];
        const legacy = legacyComputeTotals(items, 0, true);
        const next = modern(items, 0, true);
        compared++;
        if (Math.abs(legacy.total - next.totalDt) > 0.0001) {
          divergences.push({ qty, price, legacy: legacy.total, next: next.totalDt });
        }
      }
    }

    const rate = divergences.length / compared;
    // Surfaced in CI output so the compatibility plan can cite real numbers.
    console.log(
      `[money] divergence ${divergences.length}/${compared} (${(rate * 100).toFixed(3)}%). ` +
        `First 5: ${JSON.stringify(divergences.slice(0, 5))}`,
    );

    // A rate threshold alone is a weak guard — it would happily accept a
    // systematic error that happened to stay under the limit. The real
    // assertion is below: every single divergence must be a case where the
    // legacy `toFixed` mis-rounded an exact midpoint downwards.
    expect(rate).toBeLessThan(0.02);
  });

  it("proves every divergence is legacy mis-rounding, not a formula difference", () => {
    let checked = 0;

    for (let qty = 1; qty <= 12; qty++) {
      for (let cents = 1; cents <= 500; cents++) {
        const price = Math.round(cents * 7.13) / 100;
        const items = [{ quantity: qty, unit_price_dt: price }];
        const legacy = legacyComputeTotals(items, 0, true);
        const next = modern(items, 0, true);
        if (Math.abs(legacy.total - next.totalDt) <= 0.0001) continue;

        // Recompute VAT in exact integer arithmetic, free of any float:
        // net is an exact number of centimes, so net_centimes * 19 / 100 is
        // the exact VAT in centimes and can be rounded half-up precisely.
        const netCentimes = Math.round(price * qty * 100);
        const exactVatCentimes = (netCentimes * 19) / 100;
        const correctVatCentimes = Math.round(exactVatCentimes); // half-up, no float midpoint
        const correctTotal = (netCentimes + correctVatCentimes) / 100 + 1; // + stamp

        // The new implementation matches the exact-arithmetic answer …
        expect(next.totalDt).toBeCloseTo(correctTotal, 9);
        // … and legacy is the one that is off, by exactly one centime.
        expect(Math.abs(legacy.total - correctTotal)).toBeCloseTo(0.01, 9);

        checked++;
      }
    }

    expect(checked).toBeGreaterThan(0);
    console.log(`[money] verified ${checked} divergences are all legacy mis-rounding`);
  });

  it("never disagrees by more than one centime when it disagrees at all", () => {
    let worst = 0;
    for (let qty = 1; qty <= 10; qty++) {
      for (let cents = 1; cents <= 600; cents++) {
        const items = [{ quantity: qty, unit_price_dt: cents / 100 }];
        const legacy = legacyComputeTotals(items, 0, true);
        const next = modern(items, 0, true);
        worst = Math.max(worst, Math.abs(legacy.total - next.totalDt));
      }
    }
    // A larger gap would indicate an ordering or base error, not a rounding one.
    expect(worst).toBeLessThanOrEqual(0.01 + 1e-9);
  });
});

describe("cases where the new implementation is deliberately more correct", () => {
  it("rounds an exact .005 midpoint up, where toFixed rounds it down", () => {
    // 1.005 is stored as 1.00499999999999989…, so toFixed(2) yields "1.00".
    expect((1.005).toFixed(2)).toBe("1.00");
    const t = toDtView(
      computeDocumentTotals({
        items: [{ quantity: 1, unitPriceDt: 1.005 }],
        vat: { enabled: false, ratePercent: 0 },
      }),
    );
    expect(t.subtotalDt).toBe(1.01);
  });

  it("keeps line totals summing to the subtotal, which the legacy formula does not guarantee", () => {
    // Legacy rounds each stored line total independently but derives the
    // subtotal from the UNROUNDED sum, so the printed lines can fail to add up.
    const items = [
      { quantity: 3, unit_price_dt: 0.335 },
      { quantity: 3, unit_price_dt: 0.335 },
      { quantity: 3, unit_price_dt: 0.335 },
    ];
    const legacyLineSum = items.reduce(
      (s, it) => s + +(it.quantity * it.unit_price_dt).toFixed(2),
      0,
    );
    const legacySubtotal = legacyComputeTotals(items).subtotal;

    const next = modern(items);
    const nextLineSum = next.lineTotals.reduce((a, b) => a + b, 0);

    // The new implementation is self-consistent by construction.
    expect(Math.abs(nextLineSum - next.subtotalDt)).toBeLessThan(1e-9);
    // Recorded for the compatibility plan.
    console.log(
      `[money] legacy line-sum ${legacyLineSum} vs legacy subtotal ${legacySubtotal}`,
    );
  });

  it("does not accumulate float error across many lines", () => {
    const items = Array.from({ length: 300 }, () => ({ quantity: 1, unit_price_dt: 0.1 }));
    const next = modern(items);
    expect(next.subtotalDt).toBe(30);
  });
});
