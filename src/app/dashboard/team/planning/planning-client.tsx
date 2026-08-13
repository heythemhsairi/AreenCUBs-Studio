"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { setWorkLocationAction } from "@/app/dashboard/work-schedule-actions";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScheduleStatusPicker } from "@/components/work-calendar";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/provider";
import type { WorkLocation } from "@/lib/work-schedule";
import { cn } from "@/lib/utils";

type Loc = WorkLocation | null;
type CellKey = string;

const LOCATION_STYLE: Record<WorkLocation, { icon: string; short: string; cell: string }> = {
  office: { icon: "🏢", short: "O", cell: "bg-brand text-white" },
  home: { icon: "🏠", short: "M", cell: "bg-info-weak text-info" },
  absence: { icon: "⛔", short: "A", cell: "bg-warning-weak text-warning" },
  vacation: { icon: "🌴", short: "C", cell: "bg-success-weak text-success" },
};

export type TeamMember = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  schedule: Record<string, WorkLocation>;
  workload?: { active: number; overdue: number; due_today: number };
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthDays(monthStart: Date) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  return Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => {
    const date = new Date(year, month, index + 1);
    return {
      date: ymd(date),
      dayNum: index + 1,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
}

function key(userId: string, date: string): CellKey {
  return `${userId}|${date}`;
}

export function TeamPlanningClient({ members, today }: { members: TeamMember[]; today?: string }) {
  const { t } = useI18n();
  const [viewedMonth, setViewedMonth] = useState(() => {
    const d = today ? new Date(`${today}T12:00:00`) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [paintStatus, setPaintStatus] = useState<Loc>("office");
  const [edits, setEdits] = useState<Record<CellKey, Loc>>({});
  const [pendingKey, setPendingKey] = useState<CellKey | null>(null);
  const [, startTransition] = useTransition();
  const days = useMemo(() => buildMonthDays(viewedMonth), [viewedMonth]);
  const todayStr = today ?? ymd(new Date());
  const labels: Record<WorkLocation, string> = {
    office: t.planning.office,
    home: t.planning.home,
    absence: t.planning.absence,
    vacation: t.planning.vacation,
  };

  function locFor(userId: string, date: string): Loc {
    const cellKey = key(userId, date);
    if (cellKey in edits) return edits[cellKey];
    return members.find((member) => member.id === userId)?.schedule[date] ?? null;
  }

  function onCellClick(userId: string, date: string) {
    const cellKey = key(userId, date);
    setEdits((current) => ({ ...current, [cellKey]: paintStatus }));
    setPendingKey(cellKey);
    startTransition(async () => {
      await setWorkLocationAction(date, paintStatus, userId);
      setPendingKey((current) => (current === cellKey ? null : current));
    });
  }

  const totals = members.map((member) => {
    const total: Record<WorkLocation, number> = { office: 0, home: 0, absence: 0, vacation: 0 };
    for (const day of days) {
      const location = locFor(member.id, day.date);
      if (location) total[location]++;
    }
    return { id: member.id, ...total };
  });

  const todayBreakdown = useMemo(() => {
    const total: Record<WorkLocation, number> = { office: 0, home: 0, absence: 0, vacation: 0 };
    for (const member of members) {
      const location = locFor(member.id, todayStr);
      if (location) total[location]++;
    }
    return total;
    // Optimistic edits and the server data both affect the summary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, edits, todayStr]);

  const pickerLabels = { ...labels, clear: t.planning.clear };

  return (
    <div className="space-y-6">
      <PageHeader title={t.planning.title} description={t.planning.subtitle} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="section-label">{t.planning.today}</span>
        <SummaryChip icon="🏢" count={todayBreakdown.office} label={t.planning.todayHere} tone="brand" />
        <SummaryChip icon="🏠" count={todayBreakdown.home} label={t.planning.todayHome} tone="info" />
        <SummaryChip icon="⛔" count={todayBreakdown.absence} label={t.planning.todayAbsent} tone="warning" />
        <SummaryChip icon="🌴" count={todayBreakdown.vacation} label={t.planning.todayVacation} tone="success" />
        {(() => {
          const withOverdue = members.filter((member) => (member.workload?.overdue ?? 0) > 0);
          const withDueToday = members.filter((member) => (member.workload?.due_today ?? 0) > 0);
          const available = members.filter((member) => {
            const location = locFor(member.id, todayStr);
            return (member.workload?.active ?? 0) === 0 && location !== "absence" && location !== "vacation";
          });
          return (
            <>
              {withOverdue.length > 0 && <span className="rounded-full border border-danger bg-danger-weak px-3 py-1.5 text-xs font-semibold text-danger">⚠ {withOverdue.length} en retard</span>}
              {withDueToday.length > 0 && <span className="rounded-full border border-warning bg-warning-weak px-3 py-1.5 text-xs font-semibold text-warning">📅 {withDueToday.length} échéance ce jour</span>}
              {available.length > 0 && <span className="rounded-full border border-success bg-success-weak px-3 py-1.5 text-xs font-semibold text-success">✓ {available.length} disponible{available.length > 1 ? "s" : ""}</span>}
            </>
          );
        })()}
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold tracking-tight text-content">
                {t.overview.months[viewedMonth.getMonth()]} {viewedMonth.getFullYear()}
              </p>
              <p className="mt-0.5 text-xs text-content-3">{t.planning.hint}</p>
            </div>
            <div className="flex items-center gap-1">
              <NavButton onClick={() => setViewedMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} label="‹" />
              <button type="button" onClick={() => { const d = new Date(); setViewedMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="rounded-md px-2.5 py-1 text-xs font-semibold text-content-3 hover:bg-surface-3 hover:text-content">{t.planning.today}</button>
              <NavButton onClick={() => setViewedMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} label="›" />
            </div>
          </div>

          <ScheduleStatusPicker value={paintStatus} onChange={setPaintStatus} labels={pickerLabels} toolbarLabel={t.workCalendar.statusPicker} />

          <div className="space-y-3 md:hidden">
            {members.map((member) => {
              const memberTotals = totals.find((total) => total.id === member.id)!;
              return (
                <details key={member.id} className="group rounded-xl border border-line bg-surface">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2 marker:content-none">
                    <Avatar src={member.avatar_url} name={member.full_name ?? member.username} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-content">{member.full_name ?? member.username}</p>
                      <p className="truncate text-xs text-content-3">{member.job_title ?? t.planning.member}</p>
                    </div>
                    <CompactTotals totals={memberTotals} labels={labels} />
                    <ChevronIndicator />
                  </summary>
                  <div className="border-t border-line p-3">
                    <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-content-3">
                      {t.planning.weekdaysShort.map((day: string) => <span key={day}>{day}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {days.map((day, index) => {
                        const location = locFor(member.id, day.date);
                        const cellKey = key(member.id, day.date);
                        return (
                          <button
                            key={day.date}
                            type="button"
                            onClick={() => onCellClick(member.id, day.date)}
                            title={`${day.date} — ${location ? labels[location] : t.planning.unset}`}
                            style={index === 0 ? { gridColumnStart: ((new Date(`${day.date}T12:00:00`).getDay() + 6) % 7) + 1 } : undefined}
                            className={cn("flex h-11 flex-col items-center justify-center rounded-lg text-[10px] font-semibold transition-colors", location ? LOCATION_STYLE[location].cell : "bg-surface-3 text-content-3", day.date === todayStr && "ring-2 ring-brand ring-offset-1 ring-offset-surface", day.isWeekend && "opacity-60", pendingKey === cellKey && "opacity-40")}
                          >
                            <span>{day.dayNum}</span>
                            <span aria-hidden>{location ? LOCATION_STYLE[location].short : "–"}</span>
                          </button>
                        );
                      })}
                    </div>
                    <Link href={`/dashboard/team/planning/${member.id}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-brand hover:bg-brand/8">{t.planning.member}</Link>
                  </div>
                </details>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] border-separate border-spacing-y-1.5">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-content-3">
                  <th className="sticky left-0 z-10 bg-canvas pl-1 pr-3 text-left">{t.planning.member}</th>
                  {days.map((day) => <th key={day.date} className={cn("px-0.5 text-center", day.isWeekend && "text-content-3", day.date === todayStr && "rounded-md bg-brand/15 text-brand ring-1 ring-brand/30")}><div>{t.planning.weekdaysShort[(new Date(`${day.date}T12:00:00`).getDay() + 6) % 7]}</div><div className="font-bold">{day.dayNum}</div></th>)}
                  <th className="px-3 text-right">{t.planning.total}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const memberTotals = totals.find((total) => total.id === member.id)!;
                  return (
                    <tr key={member.id}>
                      <td className="sticky left-0 z-10 bg-canvas py-1.5 pl-1 pr-3">
                        <Link href={`/dashboard/team/planning/${member.id}`} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-surface-2">
                          <Avatar src={member.avatar_url} name={member.full_name ?? member.username} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-content">{member.full_name ?? member.username}</p>
                            {member.job_title && <p className="truncate text-[11px] text-content-3">{member.job_title}</p>}
                          </div>
                        </Link>
                      </td>
                      {days.map((day) => {
                        const location = locFor(member.id, day.date);
                        const cellKey = key(member.id, day.date);
                        return (
                          <td key={day.date} className={cn("h-7 px-0.5 text-center", day.isWeekend && "opacity-60")}>
                            <button
                              type="button"
                              onClick={() => onCellClick(member.id, day.date)}
                              title={`${day.date} — ${location ? labels[location] : t.planning.unset} · ${t.planning.clickToEdit}`}
                              className={cn("mx-auto flex h-7 w-full max-w-8 items-center justify-center rounded-md text-[10px] transition-transform hover:scale-110", location ? LOCATION_STYLE[location].cell : "bg-surface-3/60 text-content-3 hover:bg-surface-3", day.date === todayStr && !location && "ring-1 ring-inset ring-brand/40", pendingKey === cellKey && "opacity-50")}
                            >
                              <span aria-hidden>{location ? LOCATION_STYLE[location].icon : "·"}</span>
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 text-right"><CompactTotals totals={memberTotals} labels={labels} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryChip({ icon, count, label, tone }: { icon: string; count: number; label: string; tone: "brand" | "info" | "warning" | "success" }) {
  const classes = { brand: "border-brand/30 bg-brand/10 text-brand", info: "border-info/30 bg-info-weak text-info", warning: "border-warning/30 bg-warning-weak text-warning", success: "border-success/30 bg-success-weak text-success" };
  return <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", classes[tone])}><span aria-hidden className="text-base leading-none">{icon}</span><span>{count}</span><span className="font-normal text-content-3">{label}</span></span>;
}

function CompactTotals({ totals, labels }: { totals: Record<WorkLocation, number> & { id: string }; labels: Record<WorkLocation, string> }) {
  return <div className="flex shrink-0 gap-1 text-[10px] font-semibold">{(["office", "home", "absence", "vacation"] as const).map((location) => <span key={location} title={`${labels[location]}: ${totals[location]}`} className={cn("rounded px-1.5 py-0.5", LOCATION_STYLE[location].cell)}>{LOCATION_STYLE[location].short} {totals[location]}</span>)}</div>;
}

function NavButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-md text-base font-semibold text-content-3 hover:bg-surface-3 hover:text-content">{label}</button>;
}

function ChevronIndicator() {
  return <svg className="h-4 w-4 shrink-0 text-content-3 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="m5 7.5 5 5 5-5" /></svg>;
}
