"use client";

import { CalendarDays, CheckCircle2, CircleDashed, Clock, AlertTriangle } from "lucide-react";
import { useToday } from "@/lib/time/now";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Project health, above the fold.
 *
 * The detail route rendered a short "Détails" card beside a task board whose
 * columns are usually mostly empty, so at 1280px the page was a thin strip of
 * content across the top and a large amount of nothing underneath — the
 * screenshot review flagged it as the sparsest surface in the product.
 *
 * The missing thing was not decoration, it was an ANSWER. Someone opening a
 * project wants to know whether it is on track before they read individual
 * tasks. Everything here is derived from the tasks already fetched for the
 * board and from the project's own end date — nothing is invented, and no
 * additional query is made.
 */

type Task = { status: string; deadline: string | null };

export function ProjectSummary({
  tasks,
  endDate,
}: {
  tasks: Task[];
  endDate: string | null;
}) {
  const { t } = useI18n();
  const today = useToday();

  const done = tasks.filter((k) => k.status === "done").length;
  const inProgress = tasks.filter((k) => k.status === "in_progress").length;
  const open = tasks.length - done;

  // "Late" means a deadline that has passed on a task that is not finished.
  // Tasks without a deadline cannot be late; counting them as late would
  // overstate the problem, which is the failure mode that makes a health
  // indicator worth ignoring.
  const late = tasks.filter((k) => {
    if (k.status === "done" || !k.deadline) return false;
    const due = new Date(k.deadline);
    due.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }).length;

  const pct = tasks.length === 0 ? null : Math.round((done / tasks.length) * 100);

  const dueDays = (() => {
    if (!endDate) return null;
    const due = new Date(endDate);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86_400_000);
  })();

  return (
    <section aria-label={t.projects.summary.label} className="space-y-3">
      {/*
        Progress first, because it is the one number that answers "how is this
        going". `tabular-nums` so the percentage does not jitter between
        renders as tasks are completed.
      */}
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.09em] text-content-2">
            {t.projects.summary.progress}
          </h2>
          <p className="num text-sm text-content-3">
            {pct === null
              ? t.projects.summary.noTasks
              : t.projects.summary.doneOf(done, tasks.length)}
          </p>
        </div>

        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuenow={pct ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t.projects.summary.progress}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-ac",
              late > 0 ? "bg-warning" : "bg-success",
            )}
            style={{ width: `${pct ?? 0}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<CircleDashed className="h-4 w-4" />}
          label={t.projects.summary.open}
          value={open}
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label={t.projects.summary.inProgress}
          value={inProgress}
        />
        <Stat
          icon={<AlertTriangle className="h-4 w-4" />}
          label={t.projects.summary.late}
          value={late}
          tone={late > 0 ? "danger" : undefined}
        />
        <Stat
          icon={<CheckCircle2 className="h-4 w-4" />}
          label={t.projects.summary.done}
          value={done}
          tone={tasks.length > 0 && done === tasks.length ? "success" : undefined}
        />
      </div>

      {endDate && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
            dueDays !== null && dueDays < 0
              ? "border-danger/25 bg-danger-weak text-danger"
              : "border-line bg-surface text-content-2",
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            {t.projects.summary.deadline}: <span className="num">{formatDate(endDate)}</span>
            {dueDays !== null && (
              <span className="ml-1 text-content-3">
                {dueDays < 0
                  ? t.projects.summary.overdueBy(Math.abs(dueDays))
                  : t.projects.summary.inDays(dueDays)}
              </span>
            )}
          </span>
        </div>
      )}
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div
        className={cn(
          "flex items-center gap-1.5",
          tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-content-3",
        )}
      >
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={cn(
          "num mt-1.5 text-2xl font-semibold leading-none",
          tone === "danger" ? "text-danger" : "text-content",
        )}
      >
        {value}
      </p>
    </div>
  );
}
