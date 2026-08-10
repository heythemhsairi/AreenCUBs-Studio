import { describe, it, expect } from "vitest";
import {
  MILLIMES_PER_CENTIME,
  MILLIMES_PER_DT,
  ZERO,
  add,
  clamp,
  fromDt,
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

describe("roundHalfAwayFromZero", () => {
  it("rounds .5 away from zero in both directions", () => {
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(1.5)).toBe(2);
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    // Math.round would give -0 and -1 here; both are wrong for money.
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(-1.5)).toBe(-2);
  });

  it("leaves integers untouched", () => {
    expect(roundHalfAwayFromZero(7)).toBe(7);
    expect(roundHalfAwayFromZero(-7)).toBe(-7);
    expect(roundHalfAwayFromZero(0)).toBe(0);
  });

  it("rounds below and above the midpoint correctly", () => {
    expect(roundHalfAwayFromZero(0.49)).toBe(0);
    expect(roundHalfAwayFromZero(0.51)).toBe(1);
  });
});

describe("fromDt / toDt", () => {
  it("round-trips whole dinars", () => {
    expect(toDt(fromDt(100))).toBe(100);
    expect(toDt(fromDt(0))).toBe(0);
  });

  it("round-trips two-decimal amounts", () => {
    expect(toDt(fromDt(33.33))).toBe(33.33);
    expect(toDt(fromDt(0.01))).toBe(0.01);
    expect(toDt(fromDt(1234.56))).toBe(1234.56);
  });

  it("absorbs binary representation error", () => {
    // 33.33 * 1000 is 33329.999999999996 as a double.
    expect(fromDt(33.33)).toBe(33330);
    expect(fromDt(0.1)).toBe(100);
    expect(fromDt(0.2)).toBe(200);
  });

  it("produces exact integer arithmetic where floats fail", () => {
    // The canonical float failure: 0.1 + 0.2 !== 0.3
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(add(fromDt(0.1), fromDt(0.2))).toBe(fromDt(0.3));
    expect(toDt(add(fromDt(0.1), fromDt(0.2)))).toBe(0.3);
  });

  it("treats non-finite input as zero rather than throwing", () => {
    expect(fromDt(NaN)).toBe(0);
    expect(fromDt(Infinity)).toBe(0);
  });

  it("handles negatives symmetrically", () => {
    expect(fromDt(-12.5)).toBe(-12500);
    expect(toDt(fromDt(-12.5))).toBe(-12.5);
  });
});

describe("millimes brand guard", () => {
  it("rejects non-integers, which would indicate a DT value passed by mistake", () => {
    expect(() => millimes(1.5)).toThrow(RangeError);
  });

  it("rejects non-finite values", () => {
    expect(() => millimes(NaN)).toThrow(RangeError);
    expect(() => millimes(Infinity)).toThrow(RangeError);
  });

  it("accepts valid integers including zero and negatives", () => {
    expect(millimes(0)).toBe(0);
    expect(millimes(-500)).toBe(-500);
  });
});

describe("roundToCentimes", () => {
  it("rounds to the 2-decimal precision the database stores", () => {
    expect(roundToCentimes(millimes(6333))).toBe(6330); // 6.333 -> 6.33
    expect(roundToCentimes(millimes(6335))).toBe(6340); // 6.335 -> 6.34 (half up)
    expect(roundToCentimes(millimes(6337))).toBe(6340);
  });

  it("leaves exact centime values unchanged", () => {
    expect(roundToCentimes(millimes(6330))).toBe(6330);
    expect(roundToCentimes(ZERO)).toBe(0);
  });

  it("rounds negatives away from zero", () => {
    expect(roundToCentimes(millimes(-6335))).toBe(-6340);
  });

  it("always yields a value representable in numeric(10,2)", () => {
    for (let m = 0; m <= 200; m++) {
      expect(roundToCentimes(millimes(m)) % MILLIMES_PER_CENTIME).toBe(0);
    }
  });
});

describe("arithmetic helpers", () => {
  it("adds, subtracts and sums", () => {
    expect(add(millimes(100), millimes(250))).toBe(350);
    expect(subtract(millimes(500), millimes(150))).toBe(350);
    expect(sum([millimes(100), millimes(200), millimes(300)])).toBe(600);
  });

  it("sums an empty list to zero", () => {
    expect(sum([])).toBe(0);
  });

  it("multiplies by whole and fractional quantities", () => {
    expect(multiplyByQuantity(fromDt(10), 3)).toBe(fromDt(30));
    expect(multiplyByQuantity(fromDt(10), 1.5)).toBe(fromDt(15));
    expect(multiplyByQuantity(fromDt(33.33), 3)).toBe(fromDt(99.99));
  });

  it("treats a non-finite quantity as zero", () => {
    expect(multiplyByQuantity(fromDt(10), NaN)).toBe(0);
  });

  it("computes percentages", () => {
    expect(percentOf(fromDt(100), 19)).toBe(fromDt(19));
    expect(percentOf(fromDt(0), 19)).toBe(0);
    expect(percentOf(fromDt(100), 0)).toBe(0);
  });

  it("clamps into range", () => {
    expect(clamp(millimes(500), millimes(0), millimes(300))).toBe(300);
    expect(clamp(millimes(-50), millimes(0), millimes(300))).toBe(0);
    expect(clamp(millimes(150), millimes(0), millimes(300))).toBe(150);
  });
});

describe("single-step quantization — double-rounding regression", () => {
  /**
   * Caught by the legacy-equivalence sweep: rounding to millimes and then to
   * centimes inflates any exact value sitting just below a millime midpoint.
   * 19% of 0.13 DT is exactly 0.0247, which must round to 0.02, not 0.03.
   */
  it("rounds 19% of 0.13 DT to 0.02, not 0.03", () => {
    const net = fromDt(0.13);
    const exact = percentOfExact(net, 19); // 24.7 millimes, unrounded
    expect(exact).toBeCloseTo(24.7, 9);
    expect(toDt(quantizeToCentimes(exact))).toBe(0.02);
  });

  it("agrees with a single decimal rounding across a wide sweep", () => {
    for (let cents = 1; cents <= 2000; cents++) {
      const netDt = cents / 100;
      const viaModule = toDt(quantizeToCentimes(percentOfExact(fromDt(netDt), 19)));
      const viaDecimal = Math.round(netDt * 19) / 100; // exact: net*0.19 to 2dp
      expect(viaModule).toBeCloseTo(viaDecimal, 9);
    }
  });

  it("never double-rounds a product either", () => {
    // 3 x 0.335 = 1.005 exactly -> 1.01 in one step.
    const line = quantizeToCentimes(multiplyByQuantityExact(fromDt(0.335), 3));
    expect(toDt(line)).toBe(1.01);
  });

  it("quantize always lands on a centime boundary", () => {
    for (let m = 0; m <= 300; m++) {
      expect(quantizeToCentimes(m + 0.37) % MILLIMES_PER_CENTIME).toBe(0);
    }
  });

  it("treats non-finite intermediates as zero", () => {
    expect(quantizeToCentimes(NaN)).toBe(0);
    expect(percentOfExact(NaN, 19)).toBe(0);
    expect(multiplyByQuantityExact(fromDt(10), NaN)).toBe(0);
  });
});

describe("scale constants", () => {
  it("reflects the Tunisian dinar's minor units", () => {
    expect(MILLIMES_PER_DT).toBe(1000);
    expect(MILLIMES_PER_CENTIME).toBe(10);
  });
});
