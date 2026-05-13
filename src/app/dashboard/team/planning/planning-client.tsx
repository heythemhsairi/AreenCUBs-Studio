"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/dashboard/page-header";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { setWorkLocationAction } from "@/app/dashboard/work-schedule-actions";

export type TeamMember = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  schedule: Record<string, "office" | "home">;
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthDays(
  monthStart: Date,
): { date: string; dayNum: number; isWeekend: boolean }[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const out = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    out.push({
      date: ymd(d),
      dayNum: i,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return out;
}

type CellKey = string; // `${userId}|${date}`
function key(userId: string, date: string): CellKey {
  return `${userId}|${date}`;
}

export function TeamPlanningClient({ members }: { members: TeamMember[] }) {
  const { t } = useI18n();
  const [viewedMonth, setViewedMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const days = useMemo(() => buildMonthDays(viewedMonth), [viewedMonth]);

  // Optimistic edits layered over server state.
  const [edits, setEdits] = useState<
    Record<CellKey, "office" | "home" | null>
  >({});
  const [pendingKey, setPendingKey] = useState<CellKey | null>(null);
  const [, startTransition] = useTransition();

  function locFor(userId: string, date: string): "office" | "home" | null {
    const k = key(userId, date);
    if (k in edits) return edits[k];
    const m = members.find((x) => x.id === userId);
    return m?.schedule[date] ?? null;
  }

  function onCellClick(userId: string, date: string) {
    const current = locFor(userId, date);
    const next =
      current === null ? "office" : current === "office" ? "home" : null;
    const k = key(userId, date);
    setEdits((e) => ({ ...e, [k]: next }));
    setPendingKey(k);
    startTransition(async () => {
      await setWorkLocationAction(date, next, userId);
      setPendingKey((p) => (p === k ? null : p));
    });
  }

  function prevMonth() {
    setViewedMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewedMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }
  function thisMonth() {
    const d = new Date();
    setViewedMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  const todayStr = ymd(new Date());

  const totals = members.map((m) => {
    let office = 0,
      home = 0;
    for (const day of days) {
      const loc = locFor(m.id, day.date);
      if (loc === "office") office++;
      else if (loc === "home") home++;
    }
    return { id: m.id, office, home };
  });

  // Today summary across the team
  const todayBreakdown = useMemo(() => {
    let office = 0,
      home = 0;
    for (const m of members) {
      const loc = locFor(m.id, todayStr);
      if (loc === "office") office++;
      else if (loc === "home") home++;
    }
    return { office, home };
    // members + edits drive recomputation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, edits, todayStr]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.planning.title}
        description={t.planning.subtitle}
      />

      {/* Today summary chips */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="section-label">{t.planning.today}</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/12 px-3 py-1.5 text-xs font-semibold text-brand">
          <span className="text-base leading-none">🏢</span>
          <span className="text-cream/95">{todayBreakdown.office}</span>
          <span className="text-cream/55 font-normal">
            {t.planning.todayHere}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#7c4dff]/30 bg-[#7c4dff]/15 px-3 py-1.5 text-xs font-semibold text-[#bfa6ff]">
          <span className="text-base leading-none">🏠</span>
          <span className="text-cream/95">{todayBreakdown.home}</span>
          <span className="text-cream/55 font-normal">
            {t.planning.todayHome}
          </span>
        </span>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          {/* Month toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold tracking-tight text-ink">
                {t.overview.months[viewedMonth.getMonth()]}{" "}
                {viewedMonth.getFullYear()}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink/55">
                <span>{t.planning.hint}</span>
                <Swatch color="bg-brand" />
                <span>{t.planning.office}</span>
                <span className="text-ink/35">→</span>
                <Swatch color="bg-[#7c4dff]" />
                <span>{t.planning.home}</span>
                <span className="text-ink/35">→</span>
                <span>{t.planning.empty}</span>
              </p>
            </div>
            <div className="flex items-center gap-1">
              <NavButton onClick={prevMonth} label="‹" />
              <button
                type="button"
                onClick={thisMonth}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-ink/70 transition-colors hover:bg-white/10 hover:text-ink"
              >
                {t.planning.today}
              </button>
              <NavButton onClick={nextMonth} label="›" />
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-y-1.5">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/45">
                  <th className="sticky left-0 z-10 bg-[#121a2e] pl-1 pr-3 text-left">
                    {t.planning.member}
                  </th>
                  {days.map((d) => {
                    const isToday = d.date === todayStr;
                    return (
                      <th
                        key={d.date}
                        className={cn(
                          "px-0.5 text-center transition-colors",
                          d.isWeekend && "text-ink/25",
                          isToday &&
                            "rounded-md bg-brand/15 text-brand ring-1 ring-brand/30",
                        )}
                      >
                        <div>
                          {
                            t.planning.weekdaysShort[
                              (new Date(d.date).getDay() + 6) % 7
                            ]
                          }
                        </div>
                        <div className="font-bold">{d.dayNum}</div>
                      </th>
                    );
                  })}
                  <th className="px-3 text-right">{t.planning.total}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const totalsRow = totals.find((x) => x.id === m.id)!;
                  return (
                    <tr key={m.id} className="group">
                      <td className="sticky left-0 z-10 bg-[#121a2e] py-1.5 pl-1 pr-3">
                        <Link
                          href={`/dashboard/team/planning/${m.id}`}
                          className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/8"
                        >
                          <Avatar
                            src={m.avatar_url}
                            name={m.full_name ?? m.username}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {m.full_name ?? m.username}
                            </p>
                            {m.job_title && (
                              <p className="truncate text-[11px] text-ink/45">
                                {m.job_title}
                              </p>
                            )}
                          </div>
                        </Link>
                      </td>
                      {days.map((d) => {
                        const loc = locFor(m.id, d.date);
                        const k = key(m.id, d.date);
                        const isPending = pendingKey === k;
                        const isToday = d.date === todayStr;
                        return (
                          <td
                            key={d.date}
                            className={cn(
                              "h-7 px-0.5 text-center align-middle",
                              d.isWeekend && "opacity-60",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => onCellClick(m.id, d.date)}
                              title={`${d.date} — ${
                                loc === "office"
                                  ? t.planning.office
                                  : loc === "home"
                                    ? t.planning.home
                                    : t.planning.unset
                              } · ${t.planning.clickToEdit}`}
                              className={cn(
                                "mx-auto flex h-6 w-full max-w-[28px] items-center justify-center rounded-md text-[10px] transition-all hover:scale-110 hover:shadow-soft",
                                loc === "office"
                                  ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-brand-glow"
                                  : loc === "home"
                                    ? "bg-gradient-to-br from-[#7c4dff] to-[#5b3df0] text-white shadow-[0_4px_12px_-4px_rgba(124,77,255,0.55)]"
                                    : "bg-white/8 text-ink/30 hover:bg-white/15 hover:text-ink/65",
                                isToday &&
                                  loc === null &&
                                  "ring-1 ring-inset ring-brand/40",
                                isPending && "opacity-60",
                              )}
                            >
                              {loc === "office"
                                ? "🏢"
                                : loc === "home"
                                  ? "🏠"
                                  : "·"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 text-right text-xs font-semibold text-ink/70">
                        <span className="text-brand">{totalsRow.office}</span>
                        <span className="mx-1 text-ink/30">/</span>
                        <span className="text-[#bfa6ff]">
                          {totalsRow.home}
                        </span>
                      </td>
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
      className="flex h-8 w-8 items-center justify-center rounded-md text-base font-semibold text-ink/60 transition-colors hover:bg-white/10 hover:text-ink"
    >
      {label}
    </button>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-sm align-middle",
        color,
      )}
    />
  );
}
