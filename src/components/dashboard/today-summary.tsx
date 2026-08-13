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
          className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-danger/35 bg-danger-weak p-4 shadow-ac-sm transition-all duration-2 ease-ac hover:-translate-y-px hover:border-danger/55 hover:shadow-ac-md"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-danger-weak blur-2xl" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-danger/30 bg-danger/10 text-lg text-danger">
              ⚠
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-danger">
                {meCopy ? t.todaySummary.myOverdue : t.todaySummary.teamOverdue}
              </p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight text-danger">
                {overdueCount}
              </p>
            </div>
          </div>
          <span className="relative text-xs font-semibold text-danger transition-colors group-hover:text-danger/80">
            {t.todaySummary.fix}
          </span>
        </Link>
      )}

      {dueTodayCount > 0 && (
        <Link
          href="/dashboard/calendar"
          className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-warning/35 bg-warning-weak p-4 shadow-ac-sm transition-all duration-2 ease-ac hover:-translate-y-px hover:border-warning/55 hover:shadow-ac-md"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent2/15 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-lg text-warning">
              ⏰
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-warning">
                {meCopy
                  ? t.todaySummary.myDueToday
                  : t.todaySummary.teamDueToday}
              </p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight text-warning">
                {dueTodayCount}
              </p>
            </div>
          </div>
          <span className="relative text-xs font-semibold text-warning transition-colors group-hover:text-content">
            {t.todaySummary.view}
          </span>
        </Link>
      )}
    </section>
  );
}
