"use client";

import Link from "next/link";
import { AlertCircle, CalendarClock, CheckCircle2, ListTodo } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActionRequired } from "@/components/dashboard/action-required";
import { useI18n } from "@/lib/i18n/provider";
import { displayLocaleFor, formatDate } from "@/lib/format";

export type InternTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  overdue: boolean;
  projectName: string | null;
  clientName: string | null;
};

/**
 * Presentation for the intern dashboard.
 *
 * Deliberately the simplest surface in the application: what is due, what is in
 * progress, what is finished. No money, no contracts, no colleague's workload,
 * no client outside an assignment, and no internal notes.
 */
export function InternDashboardClient({
  firstName,
  tasks,
  loadError,
}: {
  firstName: string;
  tasks: InternTask[];
  loadError: string | null;
}) {
  const { t, locale } = useI18n();
  const c = t.internUi;
  const displayLocale = displayLocaleFor(locale);

  const open = tasks.filter((x) => x.status !== "done");
  const done = tasks.filter((x) => x.status === "done");
  const overdue = tasks.filter((x) => x.overdue);

  return (
    <div className="space-y-6">
      <PageHeader title={`${c.greeting} ${firstName}`} description={c.subtitle} />

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger bg-danger-weak p-4"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-ink">{c.errorTitle}</p>
            <p className="text-sm text-content-2">{c.errorHint}</p>
          </div>
        </div>
      )}

      {/*
        Overdue tasks first. An intern's whole dashboard is "what should I be
        doing", and the answer was previously a count in a tile with the actual
        list below three summary cards.
      */}
      <ActionRequired
        title={c.actionTitle}
        allClearLabel={c.actionAllClear}
        items={overdue.map((k) => ({
          id: k.id,
          href: `/dashboard/tasks/${k.id}`,
          primary: k.title,
          secondary: [k.projectName, k.clientName].filter(Boolean).join(" · ") || undefined,
          trailing: k.deadline ? (
            <span className="num text-xs text-danger">{formatDate(k.deadline)}</span>
          ) : undefined,
        }))}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label={c.kpiOpen}
          value={open.length}
          tone="cyan"
          icon={<ListTodo size={18} aria-hidden="true" />}
        />
        <KpiCard
          label={c.kpiOverdue}
          value={overdue.length}
          tone={overdue.length > 0 ? "amber" : "neutral"}
          icon={<CalendarClock size={18} aria-hidden="true" />}
        />
        <KpiCard
          label={c.kpiDone}
          value={done.length}
          tone="green"
          icon={<CheckCircle2 size={18} aria-hidden="true" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{c.tasksTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <EmptyState
              icon={<ListTodo />}
              title={c.tasksEmpty}
              description={c.tasksEmptyHint}
              size="sm"
            />
          ) : (
            <ul className="divide-y divide-line">
              {open.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/dashboard/tasks/${task.id}`}
                    className="flex flex-col gap-1 py-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                      <p className="truncate text-xs text-content-3">
                        {[task.clientName, task.projectName].filter(Boolean).join(" · ") ||
                          c.noContext}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {task.deadline && (
                        <span className="text-xs text-content-3">
                          {formatDate(task.deadline, displayLocale)}
                        </span>
                      )}
                      {task.overdue && <Badge tone="amber">{c.overdueBadge}</Badge>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-content-3">{c.scopeNote}</p>
    </div>
  );
}
