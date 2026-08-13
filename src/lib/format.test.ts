import { describe, it, expect } from "vitest";
import {
  APP_TIME_ZONE,
  EMPTY_DATE,
  displayLocaleFor,
  formatDate,
  formatDateTime,
  formatDateTimeShort,
  formatMonthLabel,
  toBusinessDateKey,
} from "./format";
import { parseDateKey } from "@/app/dashboard/content/publishing/publishing-client";

/**
 * These tests execute with TZ=UTC (pinned in vitest.config.ts) to model the
 * Vercel Node runtime. The agency's browsers run Africa/Tunis (UTC+1).
 *
 * Every assertion below therefore encodes the SERVER's environment while
 * expecting the BUSINESS's rendering. A formatter that follows the ambient
 * timezone produces UTC output here and fails — which is precisely the
 * hydration mismatch (React #418) this suite exists to prevent.
 */

describe("environment assumptions", () => {
  it("runs under UTC so that timezone bugs are detectable", () => {
    expect(process.env.TZ).toBe("UTC");
    expect(new Date().getTimezoneOffset()).toBe(0);
  });

  it("targets Africa/Tunis as the business timezone", () => {
    expect(APP_TIME_ZONE).toBe("Africa/Tunis");
  });
});

describe("formatDateTime — the hydration-error regression", () => {
  /**
   * 23:30 UTC on 9 Aug is 00:30 on 10 Aug in Africa/Tunis. Under the previous
   * `toLocaleString(undefined, …)` implementation the server rendered "9 Aug"
   * and the browser rendered "10 Aug" for this same instant — different text
   * for the same node, which is exactly what React #418 reports.
   */
  const acrossMidnight = "2026-08-09T23:30:00.000Z";

  it("renders the business-timezone day, not the UTC day", () => {
    const out = formatDateTime(acrossMidnight);
    expect(out).toContain("10");
    expect(out).not.toContain("9 août");
  });

  it("is stable regardless of how the instant is expressed", () => {
    // Same moment, three encodings. All must render identically.
    const a = formatDateTime("2026-08-09T23:30:00.000Z");
    const b = formatDateTime("2026-08-10T00:30:00+01:00");
    const c = formatDateTime(new Date(Date.UTC(2026, 7, 9, 23, 30)));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("is deterministic across repeated calls", () => {
    const first = formatDateTime(acrossMidnight);
    for (let i = 0; i < 25; i++) {
      expect(formatDateTime(acrossMidnight)).toBe(first);
    }
  });

  it("applies the UTC+1 offset to the time component", () => {
    // 12:00 UTC → 13:00 Tunis
    expect(formatDateTime("2026-08-10T12:00:00.000Z")).toContain("13:00");
  });
});

describe("formatDate", () => {
  it("formats as dd/mm/yyyy in the business timezone", () => {
    expect(formatDate("2026-08-10T12:00:00.000Z")).toBe("10/08/2026");
  });

  it("uses the business day for instants just after local midnight", () => {
    // 23:10 UTC 31 Jul == 00:10 Tunis 1 Aug — month and year both roll over.
    expect(formatDate("2026-07-31T23:10:00.000Z")).toBe("01/08/2026");
  });

  it("handles a year boundary", () => {
    expect(formatDate("2026-12-31T23:30:00.000Z")).toBe("01/01/2027");
  });

  it("returns a placeholder for null and undefined", () => {
    expect(formatDate(null)).toBe(EMPTY_DATE);
    expect(formatDate(undefined)).toBe(EMPTY_DATE);
  });

  it("echoes an unparseable string, preserving the previous contract", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatDateTimeShort", () => {
  it("renders a compact date and time in the business timezone", () => {
    const out = formatDateTimeShort("2026-08-10T12:00:00.000Z");
    expect(out).toContain("13:00");
    expect(out).toContain("2026");
  });

  it("returns a placeholder for absent values", () => {
    expect(formatDateTimeShort(null)).toBe(EMPTY_DATE);
  });
});

describe("locale selection", () => {
  it("maps the fr toggle to fr-FR and defaults unknown values to fr-FR", () => {
    expect(displayLocaleFor("fr")).toBe("fr-FR");
    expect(displayLocaleFor(undefined)).toBe("fr-FR");
    expect(displayLocaleFor(null)).toBe("fr-FR");
    expect(displayLocaleFor("zz")).toBe("fr-FR");
  });

  it("maps the en toggle to en-GB", () => {
    expect(displayLocaleFor("en")).toBe("en-GB");
  });

  it("keeps day-before-month ordering in English so dates are never reordered", () => {
    // 3 August, not 8 March.
    expect(formatDate("2026-08-03T12:00:00.000Z", "en-GB")).toBe("03/08/2026");
    expect(formatDate("2026-08-03T12:00:00.000Z", "fr-FR")).toBe("03/08/2026");
  });

  it("changes the language of the month name without changing the instant", () => {
    const fr = formatDateTime("2026-08-10T12:00:00.000Z", "fr-FR");
    const en = formatDateTime("2026-08-10T12:00:00.000Z", "en-GB");
    expect(fr).not.toBe(en);
    expect(fr).toContain("13:00");
    expect(en).toContain("13:00");
  });
});

describe("formatMonthLabel — audit finding #15 (juin/juil. collision)", () => {
  it("gives June and July distinct labels", () => {
    const june = formatMonthLabel(2026, 5);
    const july = formatMonthLabel(2026, 6);
    expect(june).toBe("06/26");
    expect(july).toBe("07/26");
    expect(june).not.toBe(july);
  });

  it("keeps all twelve months of a year mutually distinct", () => {
    const labels = Array.from({ length: 12 }, (_, m) => formatMonthLabel(2026, m));
    expect(new Set(labels).size).toBe(12);
  });

  it("stays distinct when truncated to three characters", () => {
    // The original French short names both truncate to "jui" at narrow widths.
    const truncated = Array.from({ length: 12 }, (_, m) =>
      formatMonthLabel(2026, m).slice(0, 3),
    );
    expect(new Set(truncated).size).toBe(12);
  });

  it("pads single-digit months and two-digit years", () => {
    expect(formatMonthLabel(2026, 0)).toBe("01/26");
    expect(formatMonthLabel(2005, 8)).toBe("09/05");
  });
});

describe("toBusinessDateKey", () => {
  it("returns the business day, not the UTC day", () => {
    // Under TZ=UTC, toISOString().slice(0,10) would wrongly yield 2026-08-09.
    expect(toBusinessDateKey("2026-08-09T23:30:00.000Z")).toBe("2026-08-10");
  });

  it("produces a sortable YYYY-MM-DD key", () => {
    expect(toBusinessDateKey("2026-01-05T12:00:00.000Z")).toBe("2026-01-05");
  });

  it("returns null for absent or invalid input", () => {
    expect(toBusinessDateKey(null)).toBeNull();
    expect(toBusinessDateKey("nonsense")).toBeNull();
  });
});

describe("parseDateKey — Publishing initial month/year", () => {
  it("splits a key into year and zero-based month without constructing a Date", () => {
    expect(parseDateKey("2026-08-10")).toEqual([2026, 7]);
    expect(parseDateKey("2026-01-01")).toEqual([2026, 0]);
    expect(parseDateKey("2026-12-31")).toEqual([2026, 11]);
  });

  it("round-trips with toBusinessDateKey", () => {
    const key = toBusinessDateKey("2026-08-09T23:30:00.000Z")!;
    expect(parseDateKey(key)).toEqual([2026, 7]);
  });

  it("degrades safely on malformed input rather than throwing", () => {
    expect(parseDateKey("")).toEqual([1970, 0]);
    expect(parseDateKey("garbage")).toEqual([1970, 0]);
    expect(parseDateKey("2026-13-01")).toEqual([1970, 0]);
  });
});

describe("no formatter follows the ambient locale or timezone", () => {
  /**
   * Guard against regression: these are the exact call shapes that caused the
   * production defect. If any formatter is reintroduced without an explicit
   * locale, its output under TZ=UTC diverges from the expected Tunis rendering
   * and one of the assertions above fails first — this test documents the rule.
   */
  it("differs from an ambient-locale rendering of the same instant", () => {
    const instant = "2026-08-09T23:30:00.000Z";
    const ambient = new Date(instant).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    // Ambient (UTC) says 9 Aug; the pinned formatter says 10 Aug.
    expect(formatDateTime(instant)).not.toBe(ambient);
  });
});
