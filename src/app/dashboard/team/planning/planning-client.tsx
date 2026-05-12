"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

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
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthDays(monthStart: Date): { date: string; dayNum: number; isWeekend: boolean }[] {
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

export function TeamPlanningClient({ members }: { members: TeamMember[] }) {
  const [viewedMonth, setViewedMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const days = useMemo(() => buildMonthDays(viewedMonth), [viewedMonth]);

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

  // Per-member totals for the visible month
  const totals = members.map((m) => {
    let office = 0, home = 0;
    for (const day of days) {
      const loc = m.schedule[day.date];
      if (loc === "office") office++;
      else if (loc === "home") home++;
    }
    return { id: m.id, office, home };
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-ink">
              {MONTHS[viewedMonth.getMonth()]} {viewedMonth.getFullYear()}
            </p>
            <p className="text-xs text-ink/55">
              Couleurs : <Swatch color="bg-brand" /> Bureau ·{" "}
              <Swatch color="bg-accent" /> Maison · <Swatch color="bg-ink/10" /> Non renseigné
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
                <th className="sticky left-0 z-10 bg-white pl-1 pr-3 text-left">
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
                    <div>{WEEKDAYS_SHORT[(new Date(d.date).getDay() + 6) % 7]}</div>
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
                    <td className="sticky left-0 z-10 bg-white py-1.5 pl-1 pr-3">
                      <div className="flex items-center gap-2.5">
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
                      </div>
                    </td>
                    {days.map((d) => {
                      const loc = m.schedule[d.date];
                      return (
                        <td
                          key={d.date}
                          className={cn(
                            "h-7 px-0.5 text-center align-middle",
                            d.isWeekend && "opacity-50",
                          )}
                          title={`${d.date} — ${loc ?? "non renseigné"}`}
                        >
                          <div
                            className={cn(
                              "mx-auto h-6 w-full max-w-[26px] rounded-md text-[10px]",
                              loc === "office"
                                ? "bg-brand text-white"
                                : loc === "home"
                                  ? "bg-accent text-ink"
                                  : "bg-ink/5",
                            )}
                          >
                            {loc === "office"
                              ? "🏢"
                              : loc === "home"
                                ? "🏠"
                                : ""}
                          </div>
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

function NavButton({ onClick, label }: { onClick: () => void; label: string }) {
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
      className={cn("ml-1 inline-block h-2.5 w-2.5 rounded-sm align-middle", color)}
    />
  );
}
