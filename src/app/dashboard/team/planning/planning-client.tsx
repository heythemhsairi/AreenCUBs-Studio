"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
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

const WEEKDAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

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
  const [viewedMonth, setViewedMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const days = useMemo(() => buildMonthDays(viewedMonth), [viewedMonth]);

  // Local optimistic state: merge server state with edits made in this session.
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

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold tracking-tight text-ink">
              {MONTHS[viewedMonth.getMonth()]} {viewedMonth.getFullYear()}
            </p>
            <p className="text-xs text-ink/55">
              Cliquez une cellule pour basculer{" "}
              <Swatch color="bg-brand" /> Bureau →{" "}
              <Swatch color="bg-accent" /> Maison → vide
            </p>
          </div>
          <div className="flex items-center gap-1">
            <NavButton onClick={prevMonth} label="‹" />
            <button
              type="button"
              onClick={thisMonth}
              className="rounded-md px-2 py-1 text-xs font-semibold text-ink/65 hover:bg-ink/5"
            >
              Aujourd&apos;hui
            </button>
            <NavButton onClick={nextMonth} label="›" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-y-1.5">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/45">
                <th className="sticky left-0 z-10 bg-white pl-1 pr-3 text-left dark:bg-[#15171f]">
                  Membre
                </th>
                {days.map((d) => (
                  <th
                    key={d.date}
                    className={cn(
                      "px-0.5 text-center",
                      d.isWeekend && "text-ink/25",
                      d.date === todayStr && "text-brand",
                    )}
                  >
                    <div>
                      {
                        WEEKDAYS_SHORT[
                          (new Date(d.date).getDay() + 6) % 7
                        ]
                      }
                    </div>
                    <div className="font-bold">{d.dayNum}</div>
                  </th>
                ))}
                <th className="px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const t = totals.find((x) => x.id === m.id)!;
                return (
                  <tr key={m.id} className="group">
                    <td className="sticky left-0 z-10 bg-white py-1.5 pl-1 pr-3 dark:bg-[#15171f]">
                      <Link
                        href={`/dashboard/team/planning/${m.id}`}
                        className="flex items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors hover:bg-cream-dark/40 dark:hover:bg-white/5"
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
                            title={`${d.date} — ${loc ?? "non renseigné"} (cliquez pour modifier)`}
                            className={cn(
                              "mx-auto flex h-6 w-full max-w-[28px] items-center justify-center rounded-md text-[10px] transition-all hover:scale-105 hover:shadow-soft",
                              loc === "office"
                                ? "bg-brand text-white"
                                : loc === "home"
                                  ? "bg-accent text-ink"
                                  : "bg-ink/5 text-ink/25 hover:bg-ink/10",
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
                    <td className="px-3 text-right text-xs font-medium text-ink/70">
                      <span className="text-brand">{t.office}</span>
                      {" / "}
                      <span className="text-accent-dark">{t.home}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
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

function Swatch({ color }: { color: string }) {
  return (
    <span
      className={cn(
        "ml-1 inline-block h-2.5 w-2.5 rounded-sm align-middle",
        color,
      )}
    />
  );
}
