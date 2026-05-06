"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { changeTaskStatusAction } from "./actions";
import { cn } from "@/lib/utils";

type Status = "todo" | "in_progress" | "review" | "done" | "cancelled";
type Priority = "low" | "normal" | "high" | "urgent";

export type TaskCard = {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  deadline: string | null;
  assignee: string | null;
  project: { id: string; name: string };
  client?: { id: string; name: string };
};

const COLUMN_ORDER: Status[] = ["todo", "in_progress", "review", "done"];

const columnAccent: Record<Status, string> = {
  todo: "bg-ink/30",
  in_progress: "bg-brand",
  review: "bg-accent",
  done: "bg-emerald-500",
  cancelled: "bg-red-400",
};

const priorityTone: Record<Priority, "slate" | "neutral" | "amber" | "red"> = {
  low: "slate",
  normal: "neutral",
  high: "amber",
  urgent: "red",
};

export function TasksKanban({
  tasks,
  compact,
  showProject,
}: {
  tasks: TaskCard[];
  compact?: boolean;
  showProject?: boolean;
}) {
  const { t } = useI18n();
  const grouped: Record<Status, TaskCard[]> = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
    cancelled: [],
  };
  for (const task of tasks) grouped[task.status].push(task);

  return (
    <div
      className={cn(
        "grid gap-4",
        compact
          ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {COLUMN_ORDER.map((status) => (
        <div key={status} className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 ring-1 ring-ink/5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  columnAccent[status],
                )}
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/55">
                {t.tasks.status[status]}
              </p>
            </div>
            <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold text-ink/60">
              {grouped[status].length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {grouped[status].map((task) => (
              <Card
                key={task.id}
                task={task}
                priorityTone={priorityTone[task.priority]}
                priorityLabel={t.tasks.priority[task.priority]}
                showProject={showProject}
              />
            ))}
            {grouped[status].length === 0 && (
              <div className="rounded-lg border border-dashed border-ink/12 bg-white/30 px-3 py-6 text-center text-xs text-ink/35">
                —
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({
  task,
  priorityTone,
  priorityLabel,
  showProject,
}: {
  task: TaskCard;
  priorityTone: "slate" | "neutral" | "amber" | "red";
  priorityLabel: string;
  showProject?: boolean;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  function onChangeStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as Status;
    if (newStatus === task.status) return;
    startTransition(async () => {
      await changeTaskStatusAction(task.id, newStatus);
    });
  }

  const overdueDays = task.deadline
    ? Math.floor(
        (Date.now() - new Date(task.deadline).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;
  const isOverdue =
    overdueDays !== null && overdueDays > 0 && task.status !== "done";

  return (
    <div className="group space-y-2 rounded-xl border border-ink/8 bg-white p-3 shadow-soft transition-all duration-150 hover:-translate-y-px hover:shadow-lift hover:border-brand/30">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/dashboard/tasks/${task.id}`}
          className="text-sm font-medium text-ink transition-colors hover:text-brand"
        >
          {task.title}
        </Link>
        <Badge tone={priorityTone}>{priorityLabel}</Badge>
      </div>

      {showProject && task.project && (
        <p className="text-xs text-ink/55">
          <Link
            href={`/dashboard/projects/${task.project.id}`}
            className="hover:underline"
          >
            {task.project.name}
          </Link>
          {task.client && <> · {task.client.name}</>}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-ink/55">
        <span className="truncate">
          {task.assignee ?? <em className="text-ink/40">{t.tasks.form.unassigned}</em>}
        </span>
        {task.deadline && (
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
              isOverdue
                ? "bg-red-50 text-red-700"
                : "bg-ink/5 text-ink/55",
            )}
          >
            {new Date(task.deadline).toLocaleDateString("fr-FR", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      <select
        defaultValue={task.status}
        onChange={onChangeStatus}
        disabled={pending}
        className="w-full rounded-md border border-ink/10 bg-cream/50 px-2 py-1 text-xs text-ink/70 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
      >
        <option value="todo">{t.tasks.status.todo}</option>
        <option value="in_progress">{t.tasks.status.in_progress}</option>
        <option value="review">{t.tasks.status.review}</option>
        <option value="done">{t.tasks.status.done}</option>
        <option value="cancelled">{t.tasks.status.cancelled}</option>
      </select>
    </div>
  );
}
