"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

type Props = {
  overdueCount: number;
  dueTodayCount: number;
  /** Whether this is the user's own view (My tasks) — switches copy. */
  scope: "me" | "team";
};

export function TodaySummary({ overdueCount, dueTodayCount, scope }: Props) {
  const { t } = useI18n();
  if (overdueCount === 0 && dueTodayCount === 0) return null;

  const meCopy = scope === "me";

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {overdueCount > 0 && (
        <Link
          href="/dashboard/tasks"
          className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-red-200/60 bg-gradient-to-br from-red-50 via-white to-white p-4 shadow-soft transition-all hover:shadow-lift dark:border-red-500/30 dark:from-red-500/10 dark:via-[#1a1620] dark:to-[#1a1620]"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-red-400/15 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-lg text-red-600 ring-1 ring-red-200/80 dark:bg-red-500/20 dark:text-red-300 dark:ring-red-500/30">
              ⚠
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700/80 dark:text-red-300/80">
                {meCopy ? t.todaySummary.myOverdue : t.todaySummary.teamOverdue}
              </p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight text-red-800 dark:text-red-200">
                {overdueCount}
              </p>
            </div>
          </div>
          <span className="relative text-xs font-semibold text-red-700 opacity-60 transition-opacity group-hover:opacity-100 dark:text-red-300">
            {t.todaySummary.fix}
          </span>
        </Link>
      )}

      {dueTodayCount > 0 && (
        <Link
          href="/dashboard/calendar"
          className="due-today-summary group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl p-4 shadow-soft transition-all hover:shadow-lift"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#22D3EE]/15 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <span className="due-today-summary-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg">
              ⏰
            </span>
            <div>
              <p className="due-today-summary-label text-[11px] font-semibold uppercase tracking-wider">
                {meCopy
                  ? t.todaySummary.myDueToday
                  : t.todaySummary.teamDueToday}
              </p>
              <p className="due-today-summary-count mt-0.5 text-2xl font-semibold tracking-tight">
                {dueTodayCount}
              </p>
            </div>
          </div>
          <span className="due-today-summary-link relative text-xs font-semibold opacity-60 transition-opacity group-hover:opacity-100">
            {t.todaySummary.view}
          </span>
        </Link>
      )}
    </section>
  );
}
