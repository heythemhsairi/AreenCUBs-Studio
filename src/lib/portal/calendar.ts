/**
 * UTC-safe date-grid math for the portal's compact calendar.
 *
 * Deadlines and publish dates arrive as bare `YYYY-MM-DD` strings from
 * Postgres `date` columns, and the rest of the app parses them by appending
 * `T00:00:00Z` (see `formatPortalDate`) rather than trusting the browser's
 * local timezone — the agency's browsers run Africa/Tunis, and a date built
 * from local-timezone arithmetic can silently roll to the wrong day. Every
 * function here stays on `Date.UTC` for the same reason, deliberately never
 * `date-fns`'s local-time helpers.
 */

export type PortalCalendarEntry = {
  id: string;
  /** `YYYY-MM-DD` */
  date: string;
  title: string;
  kind: "publication" | "deadline";
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** 42 consecutive UTC days (6 Monday-first weeks) covering `month` (0-indexed) of `year`. */
export function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  const mondayFirstOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month, 1 - mondayFirstOffset));
  return Array.from({ length: 42 }, (_, i) =>
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i)),
  );
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const shifted = new Date(Date.UTC(year, month + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() };
}

export function isSameUtcMonth(date: Date, year: number, month: number): boolean {
  return date.getUTCFullYear() === year && date.getUTCMonth() === month;
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function groupEntriesByDate(entries: PortalCalendarEntry[]): Map<string, PortalCalendarEntry[]> {
  const map = new Map<string, PortalCalendarEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.date);
    if (list) list.push(entry);
    else map.set(entry.date, [entry]);
  }
  return map;
}
