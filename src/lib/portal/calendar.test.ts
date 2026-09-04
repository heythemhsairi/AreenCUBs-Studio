import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  groupEntriesByDate,
  isSameUtcDay,
  isSameUtcMonth,
  parseDateKey,
  shiftMonth,
  toDateKey,
} from "./calendar";

describe("toDateKey / parseDateKey", () => {
  it("round-trips a date key through UTC", () => {
    expect(toDateKey(parseDateKey("2026-09-04"))).toBe("2026-09-04");
  });

  it("pads single-digit month and day", () => {
    expect(toDateKey(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
  });
});

describe("buildMonthGrid", () => {
  it("returns 42 days (six Monday-first weeks)", () => {
    expect(buildMonthGrid(2026, 8)).toHaveLength(42); // September 2026
  });

  it("starts the grid on a Monday", () => {
    const grid = buildMonthGrid(2026, 8);
    expect(grid[0].getUTCDay()).toBe(1);
  });

  it("includes the 1st of the target month", () => {
    const grid = buildMonthGrid(2026, 8);
    expect(grid.some((d) => isSameUtcMonth(d, 2026, 8) && d.getUTCDate() === 1)).toBe(true);
  });
});

describe("shiftMonth", () => {
  it("advances a month within the same year", () => {
    expect(shiftMonth(2026, 8, 1)).toEqual({ year: 2026, month: 9 });
  });

  it("rolls over into the next year", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });

  it("rolls back into the previous year", () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("isSameUtcDay", () => {
  it("is true for the same calendar day", () => {
    expect(isSameUtcDay(parseDateKey("2026-09-04"), new Date(Date.UTC(2026, 8, 4, 23, 59)))).toBe(true);
  });

  it("is false for different days", () => {
    expect(isSameUtcDay(parseDateKey("2026-09-04"), parseDateKey("2026-09-05"))).toBe(false);
  });
});

describe("groupEntriesByDate", () => {
  it("groups multiple entries under the same date key", () => {
    const grouped = groupEntriesByDate([
      { id: "1", date: "2026-09-04", title: "A", kind: "publication" },
      { id: "2", date: "2026-09-04", title: "B", kind: "deadline" },
      { id: "3", date: "2026-09-05", title: "C", kind: "publication" },
    ]);
    expect(grouped.get("2026-09-04")).toHaveLength(2);
    expect(grouped.get("2026-09-05")).toHaveLength(1);
  });
});
