"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { changeTaskStatusAction } from "./actions";
import { cn } from "@/lib/utils";
import { startTouchDrag } from "@/lib/touch-drag";
import { toast } from "@/components/toast";

type Status = "todo" | "in_progress" | "review" | "done" | "cancelled";
type Priority = "low" | "normal" | "high" | "urgent";

export type TaskCard = {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  deadline: string | null;
  assignee: string | null;
  assigneeId: string | null;
  project: { id: string; name: string };
  client?: { id: string; name: string };
  tags?: string[];
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
  tagColors,
}: {
  tasks: TaskCard[];
  compact?: boolean;
  showProject?: boolean;
  tagColors?: Record<string, string>;
}) {
  const { t } = useI18n();
  const [, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState<Status | null>(null);
  // Optimistic status overrides keyed by task id
  const [override, setOverride] = useState<Record<string, Status>>({});

  function moveTask(taskId: string, to: Status) {
    const task = tasks.find((x) => x.id === taskId);
    if (!task) return;
    const current = override[taskId] ?? task.status;
    if (current === to) return;
    setOverride((m) => ({ ...m, [taskId]: to }));
    startTransition(async () => {
      const res = await changeTaskStatusAction(taskId, to);
      if (!res.ok) {
        setOverride((m) => {
          const next = { ...m };
          delete next[taskId];
          return next;
        });
        toast.error(res.error);
      } else if (to === "done") {
        toast.success("Tâche terminée");
      } else {
        toast.success("Statut mis à jour");
      }
    });
  }

  const grouped: Record<Status, TaskCard[]> = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
    cancelled: [],
  };
  for (const task of tasks) {
    const effective = override[task.id] ?? task.status;
    grouped[effective].push(task);
  }

  return (
    <div
      className={cn(
        "grid gap-4",
        compact
          ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {COLUMN_ORDER.map((status) => {
        const isOver = dragOver === status;
        return (
          <div
            key={status}
            data-drop-zone={status}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOver !== status) setDragOver(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setDragOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData("text/task-id");
              setDragOver(null);
              if (taskId) moveTask(taskId, status);
            }}
            className={cn(
              "flex flex-col gap-2 rounded-2xl transition-all",
              isOver && "ring-2 ring-brand/40 bg-brand/5",
            )}
          >
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
                <KanbanCard
                  key={task.id}
                  task={task}
                  effectiveStatus={override[task.id] ?? task.status}
                  priorityTone={priorityTone[task.priority]}
                  priorityLabel={t.tasks.priority[task.priority]}
                  showProject={showProject}
                  onMove={moveTask}
                  tagColors={tagColors}
                />
              ))}
              {grouped[status].length === 0 && (
                <div
                  className={cn(
                    "rounded-lg border border-dashed px-3 py-6 text-center text-xs transition-colors",
                    isOver
                      ? "border-brand/40 bg-brand/5 text-brand-dark"
                      : "border-ink/12 bg-white/30 text-ink/35",
                  )}
                >
                  {isOver ? "Déposez ici" : "—"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  task,
  effectiveStatus,
  priorityTone,
  priorityLabel,
  showProject,
  onMove,
  tagColors,
}: {
  task: TaskCard;
  effectiveStatus: Status;
  priorityTone: "slate" | "neutral" | "amber" | "red";
  priorityLabel: string;
  showProject?: boolean;
  onMove: (id: string, to: Status) => void;
  tagColors?: Record<string, string>;
}) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);

  function onChangeStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as Status;
    if (newStatus === effectiveStatus) return;
    onMove(task.id, newStatus);
  }

  const overdueDays = task.deadline
    ? Math.floor(
        (Date.now() - new Date(task.deadline).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;
  const isOverdue =
    overdueDays !== null && overdueDays > 0 && effectiveStatus !== "done";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onTouchStart={(e) =>
        startTouchDrag(e, {
          data: task.id,
          ghostLabel: task.title,
          onDrop: (zoneId) =>
            zoneId && onMove(task.id, zoneId as Status),
        })
      }
      className={cn(
        "group space-y-2 rounded-xl border border-ink/8 bg-white p-3 shadow-soft transition-all duration-150 hover:-translate-y-px hover:shadow-lift hover:border-brand/30 cursor-grab active:cursor-grabbing",
        dragging && "opacity-50",
      )}
    >
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

      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
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

      <div className="flex items-center justify-between gap-2 text-xs text-ink/55">
        <span className="truncate">
          {task.assignee ?? (
            <em className="text-ink/40">{t.tasks.form.unassigned}</em>
          )}
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
        value={effectiveStatus}
        onChange={onChangeStatus}
        onClick={(e) => e.stopPropagation()}
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
