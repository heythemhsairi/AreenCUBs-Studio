import { roundHalfAwayFromZero } from "@/lib/money/millimes";

export type PayrollFlag = "risk" | "below" | "on_target";

export type PayrollEntry = {
  id: string;
  kind: "task" | "bonus";
  label: string;
  occurredAt: string;
  baseMillimes: number;
  aboveMillimes: number;
  points: number;
  taskId?: string;
};

export type PayrollBreakdownItem = PayrollEntry & {
  basePayoutMillimes: number;
  abovePayoutMillimes: number;
  payoutMillimes: number;
};

export type PayrollCalculation = {
  earnedMillimes: number;
  payoutMillimes: number;
  targetMillimes: number;
  baselineMillimes: number;
  progressPercent: number;
  points: number;
  flag: PayrollFlag;
  shortfallMillimes: number;
  breakdown: PayrollBreakdownItem[];
};

/**
 * Exact cliff calculation from the Areen Cubs payroll brief.
 *
 * Entries are applied chronologically. If the month finishes below target,
 * every payout contribution is zero. Once the target is reached, the part of
 * each item below the line pays at base value and the part above it uses that
 * item's own above-target ratio. This matters when an administrator changes
 * one rate away from the usual 1.5× multiplier.
 */
export function calculatePayroll(
  entries: readonly PayrollEntry[],
  targetMillimes: number,
  baselinePercent: number,
): PayrollCalculation {
  const ordered = [...entries].sort((a, b) =>
    a.occurredAt === b.occurredAt
      ? a.id.localeCompare(b.id)
      : a.occurredAt.localeCompare(b.occurredAt),
  );
  const earnedMillimes = ordered.reduce((sum, entry) => sum + entry.baseMillimes, 0);
  const points = ordered.reduce((sum, entry) => sum + entry.points, 0);
  const baselineMillimes = roundHalfAwayFromZero(
    (targetMillimes * baselinePercent) / 100,
  );
  const progressPercent = targetMillimes > 0 ? (earnedMillimes / targetMillimes) * 100 : 0;
  const flag: PayrollFlag =
    earnedMillimes >= targetMillimes
      ? "on_target"
      : earnedMillimes < baselineMillimes
        ? "risk"
        : "below";

  if (earnedMillimes < targetMillimes) {
    return {
      earnedMillimes,
      payoutMillimes: 0,
      targetMillimes,
      baselineMillimes,
      progressPercent,
      points,
      flag,
      shortfallMillimes: targetMillimes - earnedMillimes,
      breakdown: ordered.map((entry) => ({
        ...entry,
        basePayoutMillimes: 0,
        abovePayoutMillimes: 0,
        payoutMillimes: 0,
      })),
    };
  }

  let earnedBefore = 0;
  let payoutMillimes = 0;
  const breakdown = ordered.map((entry): PayrollBreakdownItem => {
    const belowCapacity = Math.max(0, targetMillimes - earnedBefore);
    const basePart = Math.min(entry.baseMillimes, belowCapacity);
    const aboveBasePart = entry.baseMillimes - basePart;
    const abovePayout =
      entry.baseMillimes > 0
        ? roundHalfAwayFromZero(
            (aboveBasePart * entry.aboveMillimes) / entry.baseMillimes,
          )
        : 0;
    const contribution = basePart + abovePayout;
    earnedBefore += entry.baseMillimes;
    payoutMillimes += contribution;
    return {
      ...entry,
      basePayoutMillimes: basePart,
      abovePayoutMillimes: abovePayout,
      payoutMillimes: contribution,
    };
  });

  return {
    earnedMillimes,
    payoutMillimes,
    targetMillimes,
    baselineMillimes,
    progressPercent,
    points,
    flag,
    shortfallMillimes: 0,
    breakdown,
  };
}

export function periodBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start, next };
}

export function workingDaysInMonth(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day++) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count++;
  }
  return count;
}

export function formatPayrollDt(millimes: number): string {
  return `${(millimes / 1000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DT`;
}

