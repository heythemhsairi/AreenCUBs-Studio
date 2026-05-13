"use client";

import { useMemo, useState, useTransition } from "react";
import { setWorkLocationAction } from "@/app/dashboard/work-schedule-actions";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

type Loc = "office" | "home" | null;

type DayCell = {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  isOtherMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
  location: Loc;
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(
  monthStart: Date,
  schedule: Record<string, "office" | "home">,
): DayCell[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // Monday-start: getDay returns 0(Sun)..6(Sat) → offset to Monday
  const offset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - offset);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const days: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + i);
    const dStr = ymd(cellDate);
    days.push({
      date: dStr,
      dayOfMonth: cellDate.getDate(),
      isOtherMonth: cellDate.getMonth() !== month,
      isWeekend: cellDate.getDay() === 0 || cellDate.getDay() === 6,
      isToday: cellDate.getTime() === todayMs,
      location: schedule[dStr] ?? null,
    });
  }
  return days;
}

export function WorkCalendar({
  initial,
  className,
  targetUserId,
  initialMonth,
}: {
  /** Map of ISO date string → location for the entire range we care about. */
  initial: Record<string, "office" | "home">;
  className?: string;
  /** If set, writes for this user (admin override). Defaults to current user. */
  targetUserId?: string;
  /** Optional initial month (defaults to today's month). */
  initialMonth?: Date;
}) {
  const { t } = useI18n();
  const [viewedMonth, setViewedMonth] = useState(() => {
    if (initialMonth)
      return new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1);
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [schedule, setSchedule] =
    useState<Record<string, "office" | "home">>(initial);
  const [pending, startTransition] = useTransition();

  const days = useMemo(
    () => buildMonthGrid(viewedMonth, schedule),
    [viewedMonth, schedule],
  );

  const officeCount = days.filter(
    (d) => !d.isOtherMonth && d.location === "office",
  ).length;
  const homeCount = days.filter(
    (d) => !d.isOtherMonth && d.location === "home",
  ).length;

  function onDayClick(d: DayCell) {
    if (d.isOtherMonth) return;
    const current = d.location;
    const next: Loc =
      current === null ? "office" : current === "office" ? "home" : null;

    setSchedule((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[d.date];
      else copy[d.date] = next;
      return copy;
    });

    startTransition(async () => {
      await setWorkLocationAction(d.date, next, targetUserId);
    });
  }

  function prevMonth() {
    setViewedMonth(
      (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
    );
  }
  function nextMonth() {
    setViewedMonth(
      (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
    );
  }
  function thisMonth() {
    const d = new Date();
    setViewedMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold tracking-tight text-ink">
            {t.overview.months[viewedMonth.getMonth()]}{" "}
            {viewedMonth.getFullYear()}
          </p>
          <p className="text-xs text-ink/55">{t.workCalendar.hint}</p>
        </div>
        <div className="flex items-center gap-1">
          <NavButton onClick={prevMonth} label="‹" />
          <button
            type="button"
            onClick={thisMonth}
            className="rounded-md px-2 py-1 text-xs font-semibold text-ink/65 hover:bg-ink/5"
          >
            {t.workCalendar.today}
          </button>
          <NavButton onClick={nextMonth} label="›" />
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-ink/40">
        {t.workCalendar.weekdays.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className={cn("grid grid-cols-7 gap-1", pending && "opacity-90")}>
        {days.map((d) => (
          <DayButton
            key={d.date}
            day={d}
            onClick={() => onDayClick(d)}
            officeLabel={t.workCalendar.office}
            homeLabel={t.workCalendar.home}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <LegendItem
          color="bg-brand"
          label={t.workCalendar.office}
          count={officeCount}
          suffix={t.workCalendar.daysSuffix}
        />
        <LegendItem
          color="bg-[#7c4dff]"
          label={t.workCalendar.home}
          count={homeCount}
          suffix={t.workCalendar.daysSuffix}
        />
      </div>
    </div>
  );
}

function NavButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-base font-semibold text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
    >
      {label}
    </button>
  );
}

function DayButton({
  day,
  onClick,
  officeLabel,
  homeLabel,
}: {
  day: DayCell;
  onClick: () => void;
  officeLabel: string;
  homeLabel: string;
}) {
  const tone =
    day.location === "office"
      ? "bg-brand text-white shadow-sm"
      : day.location === "home"
        ? "bg-[#7c4dff] text-white shadow-sm"
        : day.isWeekend
          ? "bg-white/4 text-ink/35"
          : "bg-white/8 text-ink/70 hover:bg-white/14";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={day.isOtherMonth}
      title={
        day.location === "office"
          ? `🏢 ${officeLabel}`
          : day.location === "home"
            ? `🏠 ${homeLabel}`
            : `${officeLabel} / ${homeLabel}`
      }
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-all",
        day.isOtherMonth ? "invisible" : tone,
        day.isToday && "ring-2 ring-brand ring-offset-1 ring-offset-cream",
      )}
    >
      <span>{day.dayOfMonth}</span>
      {day.location === "office" && (
        <span className="absolute bottom-0.5 right-1 text-[10px]">🏢</span>
      )}
      {day.location === "home" && (
        <span className="absolute bottom-0.5 right-1 text-[10px]">🏠</span>
      )}
    </button>
  );
}

function LegendItem({
  color,
  label,
  count,
  suffix,
}: {
  color: string;
  label: string;
  count: number;
  suffix: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink/70">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      {label}
      <strong className="text-ink">{count}</strong> {suffix}
    </span>
  );
}
