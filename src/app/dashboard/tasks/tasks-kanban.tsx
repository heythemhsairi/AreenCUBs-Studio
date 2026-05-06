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
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.tasks.status[status]}
            </p>
            <span className="text-xs text-slate-400">
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
              <div className="rounded-md border border-dashed border-slate-200 bg-white/50 px-3 py-6 text-center text-xs text-slate-400">
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

  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/dashboard/tasks/${task.id}`}
          className="text-sm font-medium text-slate-900 hover:text-brand"
        >
          {task.title}
        </Link>
        <Badge tone={priorityTone}>{priorityLabel}</Badge>
      </div>

      {showProject && task.project && (
        <p className="text-xs text-slate-500">
          <Link
            href={`/dashboard/projects/${task.project.id}`}
            className="hover:underline"
          >
            {task.project.name}
          </Link>
          {task.client && <> · {task.client.name}</>}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {task.assignee ?? <em>{t.tasks.form.unassigned}</em>}
          {task.deadline && (
            <> · {new Date(task.deadline).toLocaleDateString()}</>
          )}
        </span>
      </div>

      <select
        defaultValue={task.status}
        onChange={onChangeStatus}
        disabled={pending}
        className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand"
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
