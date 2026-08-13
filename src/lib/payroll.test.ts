import { describe, expect, it } from "vitest";
import { calculatePayroll, workingDaysInMonth, type PayrollEntry } from "./payroll";

function videos(count: number): PayrollEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `v${String(index).padStart(2, "0")}`,
    kind: "task" as const,
    label: "Vidéo",
    occurredAt: `2026-08-${String(index + 1).padStart(2, "0")}`,
    baseMillimes: 40_000,
    aboveMillimes: 60_000,
    points: 1,
  }));
}

describe("worker payroll cliff", () => {
  it("pays zero one dinar below target", () => {
    const result = calculatePayroll([{ ...videos(1)[0], baseMillimes: 649_000, aboveMillimes: 973_500 }], 650_000, 80);
    expect(result.payoutMillimes).toBe(0);
    expect(result.flag).toBe("below");
  });

  it("pays the whole target at the line", () => {
    const result = calculatePayroll([{ ...videos(1)[0], baseMillimes: 650_000, aboveMillimes: 975_000 }], 650_000, 80);
    expect(result.payoutMillimes).toBe(650_000);
    expect(result.flag).toBe("on_target");
  });

  it("matches the brief for seventeen videos", () => {
    const result = calculatePayroll(videos(17), 650_000, 80);
    expect(result.earnedMillimes).toBe(680_000);
    expect(result.payoutMillimes).toBe(695_000);
    expect(result.points).toBe(17);
  });

  it("lets a bonus cross the cliff and multiplies only its above-line part", () => {
    const entries: PayrollEntry[] = [
      { id: "work", kind: "task", label: "Travail", occurredAt: "2026-08-19", baseMillimes: 620_000, aboveMillimes: 930_000, points: 0 },
      { id: "bonus", kind: "bonus", label: "Bonus", occurredAt: "2026-08-20", baseMillimes: 50_000, aboveMillimes: 75_000, points: 0 },
    ];
    expect(calculatePayroll(entries, 650_000, 80).payoutMillimes).toBe(680_000);
  });

  it("uses the individual above-target rate when settings differ", () => {
    const entries: PayrollEntry[] = [
      { id: "a", kind: "task", label: "A", occurredAt: "2026-08-01", baseMillimes: 600_000, aboveMillimes: 900_000, points: 1 },
      { id: "b", kind: "task", label: "B", occurredAt: "2026-08-02", baseMillimes: 100_000, aboveMillimes: 200_000, points: 1 },
    ];
    expect(calculatePayroll(entries, 650_000, 80).payoutMillimes).toBe(750_000);
  });

  it("counts Monday to Friday only", () => {
    expect(workingDaysInMonth(2026, 8)).toBe(21);
  });
});
