import { describe, it, expect } from "vitest";
import { fromDt, toDt } from "./millimes";
import {
  CALCULATION_VERSION,
  DEFAULT_FISCAL_STAMP_DT,
  DEFAULT_VAT_RATE,
  SETTLEMENT_TOLERANCE,
  carryOverTaxConfiguration,
  computeBalance,
  computeDocumentTotals,
  toDtView,
  type TotalsInput,
} from "./totals";

const VAT_ON = { enabled: true, ratePercent: DEFAULT_VAT_RATE };
const VAT_OFF = { enabled: false, ratePercent: 0 };
const STAMP_ON = { enabled: true, amountDt: DEFAULT_FISCAL_STAMP_DT };
const STAMP_OFF = { enabled: false, amountDt: DEFAULT_FISCAL_STAMP_DT };

function totals(input: TotalsInput) {
  return toDtView(computeDocumentTotals(input));
}

// ── Subtotals and quantities ────────────────────────────────────────────────

describe("subtotals and quantities", () => {
  it("multiplies unit price by quantity", () => {
    const t = totals({ items: [{ quantity: 3, unitPriceDt: 250 }], vat: VAT_OFF });
    expect(t.subtotalDt).toBe(750);
  });

  it("sums multiple lines", () => {
    const t = totals({
      items: [
        { quantity: 1, unitPriceDt: 1200 },
        { quantity: 2, unitPriceDt: 350 },
        { quantity: 4, unitPriceDt: 75.5 },
      ],
      vat: VAT_OFF,
    });
    expect(t.subtotalDt).toBe(1200 + 700 + 302);
  });

  it("supports fractional quantities", () => {
    const t = totals({ items: [{ quantity: 1.5, unitPriceDt: 100 }], vat: VAT_OFF });
    expect(t.subtotalDt).toBe(150);
  });

  it("guarantees the printed lines add up to the printed subtotal", () => {
    const t = totals({
      items: [
        { quantity: 3, unitPriceDt: 33.33 },
        { quantity: 7, unitPriceDt: 11.11 },
        { quantity: 1, unitPriceDt: 0.005 },
      ],
      vat: VAT_ON,
    });
    const sumOfLines = t.lineTotals.reduce((a, b) => a + b, 0);
    expect(Math.abs(sumOfLines - t.subtotalDt)).toBeLessThan(1e-9);
  });

  it("ignores zero and negative quantities", () => {
    const t = totals({
      items: [
        { quantity: 0, unitPriceDt: 500 },
        { quantity: -2, unitPriceDt: 500 },
        { quantity: 1, unitPriceDt: 100 },
      ],
      vat: VAT_OFF,
    });
    expect(t.subtotalDt).toBe(100);
  });
});

// ── Bonus lines ─────────────────────────────────────────────────────────────

describe("bonus lines", () => {
  it("charges nothing for a bonus line even when it carries a price", () => {
    // Intrinsic to the formula — it does not depend on a caller having zeroed
    // the unit price first, which is how the legacy server path stayed correct.
    const t = totals({
      items: [
        { quantity: 1, unitPriceDt: 1000 },
        { quantity: 1, unitPriceDt: 500, isBonus: true },
      ],
      vat: VAT_OFF,
    });
    expect(t.subtotalDt).toBe(1000);
    expect(t.lineTotals[1]).toBe(0);
  });

  it("produces a zero document when every line is a bonus", () => {
    const t = totals({
      items: [{ quantity: 2, unitPriceDt: 400, isBonus: true }],
      vat: VAT_ON,
      fiscalStamp: STAMP_OFF,
    });
    expect(t.subtotalDt).toBe(0);
    expect(t.tvaDt).toBe(0);
    expect(t.totalDt).toBe(0);
  });
});

// ── Discounts ───────────────────────────────────────────────────────────────

describe("discounts", () => {
  it("applies a fixed-amount discount before VAT", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 1000 }],
      discount: { type: "amount", valueDt: 100 },
      vat: VAT_ON,
    });
    expect(t.subtotalDt).toBe(1000);
    expect(t.discountDt).toBe(100);
    expect(t.netDt).toBe(900);
    expect(t.tvaDt).toBe(171); // 19% of 900, not of 1000
  });

  it("applies a percentage discount", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 1000 }],
      discount: { type: "percent", value: 10 },
      vat: VAT_ON,
    });
    expect(t.discountDt).toBe(100);
    expect(t.netDt).toBe(900);
  });

  it("never lets a discount exceed the subtotal", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 500 }],
      discount: { type: "amount", valueDt: 5000 },
      vat: VAT_ON,
    });
    expect(t.discountDt).toBe(500);
    expect(t.netDt).toBe(0);
    expect(t.totalDt).toBe(0);
  });

  it("clamps a negative discount to zero", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 500 }],
      discount: { type: "amount", valueDt: -250 },
      vat: VAT_OFF,
    });
    expect(t.discountDt).toBe(0);
    expect(t.netDt).toBe(500);
  });

  it("clamps a percentage above 100", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 500 }],
      discount: { type: "percent", value: 150 },
      vat: VAT_OFF,
    });
    expect(t.discountDt).toBe(500);
    expect(t.netDt).toBe(0);
  });
});

// ── Optional VAT ────────────────────────────────────────────────────────────

describe("optional VAT per document", () => {
  it("omits VAT entirely when disabled", () => {
    const t = totals({ items: [{ quantity: 1, unitPriceDt: 1000 }], vat: VAT_OFF });
    expect(t.tvaDt).toBe(0);
    expect(t.tvaRate).toBe(0);
    expect(t.totalDt).toBe(1000);
  });

  it("applies VAT when enabled", () => {
    const t = totals({ items: [{ quantity: 1, unitPriceDt: 1000 }], vat: VAT_ON });
    expect(t.tvaDt).toBe(190);
    expect(t.tvaRate).toBe(19);
    expect(t.totalDt).toBe(1190);
  });

  it("supports a non-standard rate", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 1000 }],
      vat: { enabled: true, ratePercent: 7 },
    });
    expect(t.tvaDt).toBe(70);
    expect(t.tvaRate).toBe(7);
  });

  it("treats an enabled 0% rate as an explicit zero-rated document", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 1000 }],
      vat: { enabled: true, ratePercent: 0 },
    });
    expect(t.tvaDt).toBe(0);
    expect(t.totalDt).toBe(1000);
  });

  it("defaults to no VAT when the caller omits the field", () => {
    const t = totals({ items: [{ quantity: 1, unitPriceDt: 1000 }] });
    expect(t.tvaDt).toBe(0);
  });
});

// ── Fiscal stamp ────────────────────────────────────────────────────────────

describe("fiscal stamp", () => {
  it("adds the stamp after VAT and leaves it untaxed", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 1000 }],
      vat: VAT_ON,
      fiscalStamp: STAMP_ON,
    });
    expect(t.tvaDt).toBe(190); // 19% of 1000, stamp excluded from the VAT base
    expect(t.stampDt).toBe(1);
    expect(t.totalDt).toBe(1191);
  });

  it("charges no stamp when disabled", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 1000 }],
      vat: VAT_ON,
      fiscalStamp: STAMP_OFF,
    });
    expect(t.stampDt).toBe(0);
    expect(t.totalDt).toBe(1190);
  });

  it("preserves a historical stamp amount that differs from today's rate", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 100 }],
      vat: VAT_OFF,
      fiscalStamp: { enabled: true, amountDt: 0.6 },
    });
    expect(t.stampDt).toBe(0.6);
    expect(t.totalDt).toBe(100.6);
  });

  it("applies the stamp to a document with no VAT", () => {
    const t = totals({
      items: [{ quantity: 1, unitPriceDt: 100 }],
      vat: VAT_OFF,
      fiscalStamp: STAMP_ON,
    });
    expect(t.totalDt).toBe(101);
  });
});

// ── Zero-value documents (audit finding #4) ─────────────────────────────────

describe("zero-value documents", () => {
  it("totals a blank document to zero with the stamp switched off", () => {
    const t = totals({ items: [], vat: VAT_ON, fiscalStamp: STAMP_OFF });
    expect(t.subtotalDt).toBe(0);
    expect(t.tvaDt).toBe(0);
    expect(t.stampDt).toBe(0);
    expect(t.totalDt).toBe(0);
  });

  it("reports the stamp in the total whenever the stamp is actually on", () => {
    // The blank-quote confusion was a display bug: the UI printed 1.00 DT while
    // the stamp was off. Here the stamp is genuinely on, so it must be charged
    // and the two figures can never disagree.
    const t = totals({ items: [], vat: VAT_ON, fiscalStamp: STAMP_ON });
    expect(t.stampDt).toBe(1);
    expect(t.totalDt).toBe(1);
  });

  it("keeps an empty line list consistent", () => {
    const t = totals({ items: [] });
    expect(t.lineTotals).toEqual([]);
    expect(t.totalDt).toBe(0);
  });
});

// ── Rounding boundaries ─────────────────────────────────────────────────────

describe("rounding boundaries", () => {
  it("rounds VAT half up at an exact midpoint", () => {
    // net 33.00 at 19% = 6.27 exactly; net 16.50 at 19% = 3.135 -> 3.14
    const t = totals({ items: [{ quantity: 1, unitPriceDt: 16.5 }], vat: VAT_ON });
    expect(t.tvaDt).toBe(3.14);
  });

  it("keeps components summing to the total across many awkward inputs", () => {
    for (let cents = 1; cents <= 400; cents++) {
      const price = cents / 100;
      const t = totals({
        items: [{ quantity: 3, unitPriceDt: price }],
        discount: { type: "percent", value: 7 },
        vat: VAT_ON,
        fiscalStamp: STAMP_ON,
      });
      const recomposed = t.netDt + t.tvaDt + t.stampDt;
      expect(Math.abs(recomposed - t.totalDt)).toBeLessThan(1e-9);
      expect(Math.abs(t.subtotalDt - t.discountDt - t.netDt)).toBeLessThan(1e-9);
    }
  });

  it("stores every component at 2-decimal precision", () => {
    const t = totals({
      items: [{ quantity: 7, unitPriceDt: 14.29 }],
      discount: { type: "percent", value: 3 },
      vat: VAT_ON,
      fiscalStamp: STAMP_ON,
    });
    for (const v of [t.subtotalDt, t.discountDt, t.netDt, t.tvaDt, t.stampDt, t.totalDt]) {
      expect(Math.abs(Math.round(v * 100) - v * 100)).toBeLessThan(1e-6);
    }
  });

  it("does not accumulate float drift over many lines", () => {
    const items = Array.from({ length: 300 }, () => ({ quantity: 1, unitPriceDt: 0.1 }));
    const t = totals({ items, vat: VAT_OFF });
    expect(t.subtotalDt).toBe(30);
  });
});

// ── Payments, partial payments and balances ─────────────────────────────────

describe("payments and balances", () => {
  it("reports unpaid when nothing has been received", () => {
    const b = computeBalance(fromDt(1190), []);
    expect(b.status).toBe("unpaid");
    expect(toDt(b.balanceDue)).toBe(1190);
    expect(b.isSettled).toBe(false);
  });

  it("reports partial for an incomplete payment", () => {
    const b = computeBalance(fromDt(1190), [{ amountDt: 500 }]);
    expect(b.status).toBe("partial");
    expect(toDt(b.amountPaid)).toBe(500);
    expect(toDt(b.balanceDue)).toBe(690);
  });

  it("aggregates multiple partial payments to paid", () => {
    const b = computeBalance(fromDt(1190), [
      { amountDt: 500 },
      { amountDt: 400 },
      { amountDt: 290 },
    ]);
    expect(b.status).toBe("paid");
    expect(toDt(b.balanceDue)).toBe(0);
  });

  it("settles within the approved tolerance", () => {
    const b = computeBalance(fromDt(1190), [{ amountDt: 1189.99 }]);
    expect(b.status).toBe("paid");
    expect(b.isSettled).toBe(true);
  });

  it("does NOT settle a 1 DT shortfall — audit finding #5", () => {
    // This is the exact production contradiction: an invoice marked paid while
    // 1 DT remained outstanding. Status is derived, so it cannot be claimed.
    const b = computeBalance(fromDt(1190), [{ amountDt: 1189 }]);
    expect(b.status).toBe("partial");
    expect(toDt(b.balanceDue)).toBe(1);
    expect(b.isSettled).toBe(false);
  });

  it("flags an overpayment instead of reporting a negative balance", () => {
    const b = computeBalance(fromDt(1000), [{ amountDt: 1200 }]);
    expect(b.status).toBe("overpaid");
    expect(toDt(b.balanceDue)).toBe(0);
    expect(toDt(b.amountPaid)).toBe(1200);
  });

  it("treats a zero-value document with no payments as settled", () => {
    const b = computeBalance(fromDt(0), []);
    expect(b.status).toBe("paid");
    expect(b.isSettled).toBe(true);
  });

  it("uses one approved tolerance constant", () => {
    expect(toDt(SETTLEMENT_TOLERANCE)).toBe(0.01);
  });
});

// ── Quote to invoice conversion ─────────────────────────────────────────────

describe("quote-to-invoice conversion", () => {
  it("carries the quote's tax snapshot onto the invoice", () => {
    const quote = {
      vat: { enabled: true, ratePercent: 19 },
      fiscalStamp: { enabled: false, amountDt: 1 },
    };
    expect(carryOverTaxConfiguration(quote)).toEqual(quote);
  });

  it("produces an identical total for the converted invoice", () => {
    const items = [
      { quantity: 2, unitPriceDt: 780.5 },
      { quantity: 1, unitPriceDt: 129.99 },
    ];
    const discount = { type: "percent" as const, value: 5 };
    const quoteConfig = {
      vat: { enabled: true, ratePercent: 19 },
      fiscalStamp: { enabled: true, amountDt: 1 },
    };

    const quote = totals({ items, discount, ...quoteConfig });
    const invoice = totals({ items, discount, ...carryOverTaxConfiguration(quoteConfig) });

    expect(invoice.totalDt).toBe(quote.totalDt);
    expect(invoice.tvaDt).toBe(quote.tvaDt);
    expect(invoice.stampDt).toBe(quote.stampDt);
  });

  it("preserves a zero-rated quote's configuration rather than applying today's default", () => {
    const zeroRated = {
      vat: { enabled: false, ratePercent: 0 },
      fiscalStamp: { enabled: false, amountDt: 1 },
    };
    const carried = carryOverTaxConfiguration(zeroRated);
    const invoice = totals({ items: [{ quantity: 1, unitPriceDt: 1000 }], ...carried });
    expect(invoice.tvaDt).toBe(0);
    expect(invoice.totalDt).toBe(1000);
  });
});

// ── Determinism and versioning ──────────────────────────────────────────────

describe("determinism and versioning", () => {
  it("stamps the calculation version onto every result", () => {
    const t = totals({ items: [{ quantity: 1, unitPriceDt: 10 }] });
    expect(t.calculationVersion).toBe(CALCULATION_VERSION);
  });

  it("returns identical output for identical input", () => {
    const input: TotalsInput = {
      items: [{ quantity: 3, unitPriceDt: 33.33 }],
      discount: { type: "percent", value: 7 },
      vat: VAT_ON,
      fiscalStamp: STAMP_ON,
    };
    const a = computeDocumentTotals(input);
    for (let i = 0; i < 50; i++) {
      expect(computeDocumentTotals(input)).toEqual(a);
    }
  });

  it("never throws on malformed input", () => {
    expect(() =>
      totals({
        items: [
          { quantity: NaN, unitPriceDt: NaN },
          { quantity: Infinity, unitPriceDt: -0 },
        ],
        discount: { type: "percent", value: NaN },
        vat: { enabled: true, ratePercent: NaN },
        fiscalStamp: { enabled: true, amountDt: NaN },
      }),
    ).not.toThrow();
  });
});
