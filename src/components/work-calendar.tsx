"use client";

import { useMemo, useState, useTransition } from "react";
import { setWorkLocationAction } from "@/app/dashboard/work-schedule-actions";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import type { WorkLocation } from "@/lib/work-schedule";

type Loc = WorkLocation | null;

const STATUS_STYLE: Record<WorkLocation, { icon: string; swatch: string; day: string }> = {
  office: { icon: "🏢", swatch: "bg-brand-500", day: "border-brand-500 bg-brand-500 text-white shadow-ac-sm" },
  home: { icon: "🏠", swatch: "bg-info", day: "border-info/35 bg-info-weak text-info" },
  absence: { icon: "⛔", swatch: "bg-warning", day: "border-warning/35 bg-warning-weak text-warning" },
  vacation: { icon: "🌴", swatch: "bg-success", day: "border-success/35 bg-success-weak text-success" },
};

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
  schedule: Record<string, WorkLocation>,
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
  initial: Record<string, WorkLocation>;
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
  const [schedule, setSchedule] = useState<Record<string, WorkLocation>>(initial);
  const [paintStatus, setPaintStatus] = useState<Loc>("office");
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
  const absenceCount = days.filter(
    (d) => !d.isOtherMonth && d.location === "absence",
  ).length;
  const vacationCount = days.filter(
    (d) => !d.isOtherMonth && d.location === "vacation",
  ).length;

  function onDayClick(d: DayCell) {
    if (d.isOtherMonth) return;
    const next = paintStatus;

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
          <p className="text-xs text-content-3">{t.workCalendar.hint}</p>
        </div>
        <div className="flex items-center gap-1">
          <NavButton onClick={prevMonth} label="‹" />
          <button
            type="button"
            onClick={thisMonth}
            className="rounded-md px-2 py-1 text-xs font-semibold text-content-3 hover:bg-ink/5"
          >
            {t.workCalendar.today}
          </button>
          <NavButton onClick={nextMonth} label="›" />
        </div>
      </div>

      {/* Weekday header */}
      <ScheduleStatusPicker
        value={paintStatus}
        onChange={setPaintStatus}
        toolbarLabel={t.workCalendar.statusPicker}
        labels={{
          office: t.workCalendar.office,
          home: t.workCalendar.home,
          absence: t.workCalendar.absence,
          vacation: t.workCalendar.vacation,
          clear: t.workCalendar.clear,
        }}
      />

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-content-3">
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
            absenceLabel={t.workCalendar.absence}
            vacationLabel={t.workCalendar.vacation}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:items-center sm:justify-center sm:gap-4">
        <LegendItem
          color={STATUS_STYLE.office.swatch}
          label={t.workCalendar.office}
          count={officeCount}
          suffix={t.workCalendar.daysSuffix}
        />
        <LegendItem
          color={STATUS_STYLE.home.swatch}
          label={t.workCalendar.home}
          count={homeCount}
          suffix={t.workCalendar.daysSuffix}
        />
        <LegendItem color={STATUS_STYLE.absence.swatch} label={t.workCalendar.absence} count={absenceCount} suffix={t.workCalendar.daysSuffix} />
        <LegendItem color={STATUS_STYLE.vacation.swatch} label={t.workCalendar.vacation} count={vacationCount} suffix={t.workCalendar.daysSuffix} />
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
      className="flex h-7 w-7 items-center justify-center rounded-md text-base font-semibold text-content-3 transition-colors hover:bg-ink/5 hover:text-ink"
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
  absenceLabel,
  vacationLabel,
}: {
  day: DayCell;
  onClick: () => void;
  officeLabel: string;
  homeLabel: string;
  absenceLabel: string;
  vacationLabel: string;
}) {
  const labels: Record<WorkLocation, string> = {
    office: officeLabel,
    home: homeLabel,
    absence: absenceLabel,
    vacation: vacationLabel,
  };
  const tone =
    day.location
      ? STATUS_STYLE[day.location].day
      : day.isWeekend
          ? "bg-surface/4 text-content-3"
          : "bg-surface/8 text-content-2 hover:bg-surface/14";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={day.isOtherMonth}
      title={
        day.location
          ? `${STATUS_STYLE[day.location].icon} ${labels[day.location]}`
          : `${officeLabel} / ${homeLabel} / ${absenceLabel} / ${vacationLabel}`
      }
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-lg border border-transparent text-sm font-medium transition-all duration-2 ease-ac hover:-translate-y-px",
        day.isOtherMonth ? "invisible" : tone,
        day.isToday && "ring-2 ring-brand ring-offset-1 ring-offset-cream",
      )}
    >
      <span>{day.dayOfMonth}</span>
      {day.location ? <span className="absolute bottom-0.5 right-1 text-[10px]">{STATUS_STYLE[day.location].icon}</span> : null}
    </button>
  );
}

export function ScheduleStatusPicker({
  value,
  onChange,
  labels,
  toolbarLabel,
}: {
  value: Loc;
  onChange: (value: Loc) => void;
  labels: Record<WorkLocation, string> & { clear: string };
  toolbarLabel?: string;
}) {
  const options: { value: Loc; label: string; icon: string; active: string }[] = [
    { value: "office", label: labels.office, icon: STATUS_STYLE.office.icon, active: "border-brand-500 bg-brand-500 text-white" },
    { value: "home", label: labels.home, icon: STATUS_STYLE.home.icon, active: "border-info/40 bg-info-weak text-info" },
    { value: "absence", label: labels.absence, icon: STATUS_STYLE.absence.icon, active: "border-warning/40 bg-warning-weak text-warning" },
    { value: "vacation", label: labels.vacation, icon: STATUS_STYLE.vacation.icon, active: "border-success/40 bg-success-weak text-success" },
    { value: null, label: labels.clear, icon: "×", active: "border-line-strong bg-surface-3 text-content" },
  ];

  return (
    <div className="flex flex-wrap gap-2" role="toolbar" aria-label={toolbarLabel ?? "Planning status"}>
      {options.map((option) => (
        <button
          key={option.value ?? "clear"}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all duration-2 ease-ac",
            value === option.value
              ? option.active
              : "border-line bg-surface text-content-2 hover:border-line-strong hover:bg-surface-2",
          )}
        >
          <span aria-hidden>{option.icon}</span>
          {option.label}
        </button>
      ))}
    </div>
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
    <span className="inline-flex items-center gap-1.5 text-content-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      {label}
      <strong className="text-ink">{count}</strong> {suffix}
    </span>
  );
}
