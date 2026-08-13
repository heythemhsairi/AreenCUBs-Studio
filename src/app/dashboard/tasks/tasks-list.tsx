"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useNow } from "@/lib/time/now";
import type { TaskCard } from "./tasks-kanban";

type Status = "todo" | "in_progress" | "review" | "done" | "cancelled";
type Priority = "low" | "normal" | "high" | "urgent";

const priorityTone: Record<Priority, "slate" | "neutral" | "amber" | "red"> = {
  low: "slate",
  normal: "neutral",
  high: "amber",
  urgent: "red",
};

const statusTone: Record<Status, "slate" | "blue" | "amber" | "green" | "red"> = {
  todo: "slate",
  in_progress: "blue",
  review: "amber",
  done: "green",
  cancelled: "red",
};

export function TasksList({
  tasks,
  tagColors,
}: {
  tasks: TaskCard[];
  tagColors?: Record<string, string>;
}) {
  const { t } = useI18n();
  const now = useNow();

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="space-y-3 p-3 md:hidden">
        {tasks.map((task) => {
          const overdueDays = task.deadline
            ? Math.floor((now.getTime() - new Date(task.deadline).getTime()) / 86_400_000)
            : null;
          const isOverdue = overdueDays !== null && overdueDays > 0 && task.status !== "done";
          return (
            <article key={task.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/dashboard/tasks/${task.id}`} className="block truncate font-semibold text-ink hover:text-brand">
                    {task.title}
                  </Link>
                  <p className="mt-1 truncate text-xs text-content-3">
                    {task.project?.name ?? "—"}{task.client ? ` · ${task.client.name}` : ""}
                  </p>
                </div>
                <Badge tone={statusTone[task.status]}>{t.tasks.status[task.status]}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={priorityTone[task.priority]}>{t.tasks.priority[task.priority]}</Badge>
                {task.tags?.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-md bg-brand/8 px-1.5 py-0.5 text-[10px] font-medium text-brand-dark">#{tag}</span>
                ))}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs">
                <div>
                  <dt className="text-content-3">Assigné</dt>
                  <dd className="mt-1 font-medium text-content-2">{task.assignee ?? t.tasks.form.unassigned}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-content-3">Échéance</dt>
                  <dd className={cn("mt-1 font-medium", isOverdue ? "text-danger" : "text-content-2")}>{formatDate(task.deadline)}</dd>
                  {isOverdue && <span className="text-[10px] font-semibold text-danger">+{overdueDays}j de retard</span>}
                </div>
              </dl>
            </article>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-ink/8 bg-surface/40 text-left">
              <Th>Tâche</Th>
              <Th>Projet</Th>
              <Th>Assigné</Th>
              <Th>Priorité</Th>
              <Th>Statut</Th>
              <Th>Estimé</Th>
              <Th>Échéance</Th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const overdueDays = task.deadline
                ? Math.floor(
                    (now.getTime() - new Date(task.deadline).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                : null;
              const isOverdue =
                overdueDays !== null &&
                overdueDays > 0 &&
                task.status !== "done";
              return (
                <tr
                  key={task.id}
                  className="border-b border-ink/5 transition-colors last:border-0 hover:bg-surface/45 dark:hover:bg-surface/5"
                >
                  <Td>
                    <Link
                      href={`/dashboard/tasks/${task.id}`}
                      className="font-medium text-ink transition-colors hover:text-brand"
                    >
                      {task.title}
                    </Link>
                    {task.tags && task.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {task.tags.slice(0, 4).map((tag) => {
                          const c = tagColors?.[tag];
                          return c ? (
                            <span
                              key={tag}
                              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: c }}
                            >
                              #{tag}
                            </span>
                          ) : (
                            <span
                              key={tag}
                              className="rounded-md bg-brand/8 px-1.5 py-0.5 text-[10px] font-medium text-brand-dark"
                            >
                              #{tag}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <span className="text-content-3">
                      {task.project?.name ?? "—"}
                    </span>
                    {task.client && (
                      <span className="block text-[11px] text-content-3">
                        {task.client.name}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-content-2">
                      {task.assignee ?? (
                        <em className="text-content-3">
                          {t.tasks.form.unassigned}
                        </em>
                      )}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={priorityTone[task.priority]}>
                      {t.tasks.priority[task.priority]}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={statusTone[task.status]}>
                      {t.tasks.status[task.status]}
                    </Badge>
                  </Td>
                  <Td>
                    {task.estimated_minutes != null ? (
                      <span className="text-xs text-content-3">
                        {task.estimated_minutes >= 60
                          ? `${Math.round(task.estimated_minutes / 60)}h`
                          : `${task.estimated_minutes}m`}
                      </span>
                    ) : (
                      <span className="text-content-3">—</span>
                    )}
                  </Td>
                  <Td>
                    {task.deadline ? (
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-medium",
                            isOverdue
                              ? "bg-danger-weak text-danger"
                              : "bg-ink/5 text-content-3",
                          )}
                        >
                          {formatDate(task.deadline)}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] font-semibold text-danger">
                            ⚠ +{overdueDays}j de retard
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-content-3">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-content-3">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-top text-sm">{children}</td>;
}
