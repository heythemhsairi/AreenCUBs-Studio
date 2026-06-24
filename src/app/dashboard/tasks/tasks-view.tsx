"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { TasksKanban, type TaskCard } from "./tasks-kanban";
import { TasksList } from "./tasks-list";
import {
  TasksToolbar,
  DEFAULT_FILTERS,
  type TasksFilters,
  type View,
} from "./tasks-toolbar";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

type QuickFilter =
  | "active"
  | "today"
  | "overdue"
  | "this_week"
  | "in_progress"
  | "review"
  | "my_tasks"
  | "done";

const QUICK_FILTERS: { id: QuickFilter; label: string; icon: string }[] = [
  { id: "active",      label: "Actives",       icon: "⚡" },
  { id: "my_tasks",   label: "Mes tâches",     icon: "👤" },
  { id: "overdue",    label: "En retard",      icon: "🔴" },
  { id: "today",      label: "Aujourd'hui",    icon: "📅" },
  { id: "this_week",  label: "Cette semaine",  icon: "📆" },
  { id: "in_progress",label: "En cours",       icon: "🔄" },
  { id: "review",     label: "À valider",      icon: "👀" },
  { id: "done",       label: "Terminées",      icon: "✅" },
];

export function TasksView({
  tasks,
  projects,
  assignees,
  currentUserId,
  currentUserAssigneeId,
  tagColors,
  isFreelancer,
}: {
  tasks: TaskCard[];
  projects: Option[];
  assignees: Option[];
  currentUserId: string;
  currentUserAssigneeId: string;
  tagColors?: Record<string, string>;
  isFreelancer: boolean;
}) {
  const { t } = useI18n();
  const [filters, setFilters] = useState<TasksFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<View>("kanban");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("active");

  // Counts per quick filter for badges
  const qCounts = useMemo(
    () => computeQuickCounts(tasks, currentUserAssigneeId),
    [tasks, currentUserAssigneeId],
  );

  const filtered = useMemo(() => {
    const afterQuick = applyQuickFilter(tasks, quickFilter, currentUserAssigneeId);
    return applyFilters(afterQuick, filters, currentUserAssigneeId);
  }, [tasks, filters, quickFilter, currentUserAssigneeId]);

  function selectQuick(qf: QuickFilter) {
    setQuickFilter(qf);
    // Reset the advanced toolbar filters when switching quick filters
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={isFreelancer ? t.tasks.myTitle : t.tasks.title}
        description={
          isFreelancer ? t.tasksUi.descriptionMine : t.tasksUi.description
        }
        action={
          !isFreelancer ? (
            <Link href="/dashboard/tasks/new">
              <Button>{t.tasksUi.newTaskCta}</Button>
            </Link>
          ) : null
        }
      />

      {/* Quick filter strip */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map((qf) => {
          const count = qCounts[qf.id];
          const isActive = quickFilter === qf.id;
          return (
            <button
              key={qf.id}
              type="button"
              onClick={() => selectQuick(qf.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all",
                isActive
                  ? "border-brand/40 bg-brand text-white shadow-sm"
                  : "border-ink/10 bg-white/70 text-ink/70 hover:border-brand/20 hover:bg-white hover:text-ink",
                qf.id === "overdue" && !isActive && count > 0
                  ? "border-red-200 bg-red-50/60 text-red-700"
                  : "",
              )}
            >
              <span>{qf.icon}</span>
              <span>{qf.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0 text-[10px] font-semibold",
                    isActive
                      ? "bg-white/25 text-white"
                      : qf.id === "overdue"
                        ? "bg-red-100 text-red-700"
                        : "bg-ink/8 text-ink/60",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <TasksToolbar
        filters={filters}
        onChange={setFilters}
        view={view}
        onViewChange={setView}
        projects={projects}
        assignees={assignees}
        currentUserId={currentUserId}
        resultCount={filtered.length}
      />
      {filtered.length === 0 ? (
        <EmptyState />
      ) : view === "kanban" ? (
        <TasksKanban tasks={filtered} showProject tagColors={tagColors} />
      ) : (
        <TasksList tasks={filtered} tagColors={tagColors} />
      )}
    </div>
  );
}

function applyQuickFilter(
  tasks: TaskCard[],
  qf: QuickFilter,
  meId: string,
): TaskCard[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  switch (qf) {
    case "active":
      return tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
    case "my_tasks":
      return tasks.filter(
        (t) => t.assigneeId === meId && t.status !== "done" && t.status !== "cancelled",
      );
    case "overdue": {
      return tasks.filter((t) => {
        if (!t.deadline || t.status === "done" || t.status === "cancelled") return false;
        const d = new Date(t.deadline);
        d.setHours(0, 0, 0, 0);
        return d.getTime() < now.getTime();
      });
    }
    case "today": {
      return tasks.filter((t) => {
        if (!t.deadline || t.status === "done") return false;
        const d = new Date(t.deadline);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === now.getTime();
      });
    }
    case "this_week": {
      return tasks.filter((t) => {
        if (!t.deadline || t.status === "done") return false;
        const d = new Date(t.deadline);
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= now.getTime() && d.getTime() <= endOfWeek.getTime();
      });
    }
    case "in_progress":
      return tasks.filter((t) => t.status === "in_progress");
    case "review":
      return tasks.filter((t) => t.status === "review");
    case "done":
      return tasks.filter((t) => t.status === "done");
    default:
      return tasks;
  }
}

function computeQuickCounts(
  tasks: TaskCard[],
  meId: string,
): Record<QuickFilter, number> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  const counts: Record<QuickFilter, number> = {
    active: 0,
    my_tasks: 0,
    overdue: 0,
    today: 0,
    this_week: 0,
    in_progress: 0,
    review: 0,
    done: 0,
  };

  for (const t of tasks) {
    const isDone = t.status === "done";
    const isCancelled = t.status === "cancelled";
    if (!isDone && !isCancelled) counts.active++;
    if (t.assigneeId === meId && !isDone && !isCancelled) counts.my_tasks++;
    if (t.status === "in_progress") counts.in_progress++;
    if (t.status === "review") counts.review++;
    if (isDone) counts.done++;
    if (t.deadline && !isDone && !isCancelled) {
      const d = new Date(t.deadline);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() < now.getTime()) counts.overdue++;
      else if (d.getTime() === now.getTime()) counts.today++;
      else if (d.getTime() <= endOfWeek.getTime()) counts.this_week++;
    }
  }
  return counts;
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="glass flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-16 text-center">
      <span className="text-3xl">🔍</span>
      <p className="text-sm font-medium text-ink">{t.tasksUi.noResults}</p>
      <p className="max-w-sm text-xs text-ink/55">{t.tasksUi.noResultsHint}</p>
    </div>
  );
}

function applyFilters(
  tasks: TaskCard[],
  f: TasksFilters,
  meId: string,
): TaskCard[] {
  const q = f.search.trim().toLowerCase();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const endOfMonth = new Date(now);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);

  return tasks.filter((t) => {
    if (q.length > 0) {
      const hay =
        `${t.title} ${t.project?.name ?? ""} ${t.client?.name ?? ""} ${t.assignee ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.status !== "all" && t.status !== f.status) return false;
    if (f.priority !== "all" && t.priority !== f.priority) return false;

    if (f.assigneeId !== "all") {
      if (f.assigneeId === "me") {
        if (t.assigneeId !== meId) return false;
      } else if (f.assigneeId === "unassigned") {
        if (t.assigneeId !== null) return false;
      } else if (t.assigneeId !== f.assigneeId) return false;
    }

    if (f.projectId !== "all" && t.project?.id !== f.projectId) return false;

    if (f.deadline !== "all") {
      const d = t.deadline ? new Date(t.deadline) : null;
      if (f.deadline === "none") {
        if (d !== null) return false;
      } else if (d === null) {
        return false;
      } else {
        d.setHours(0, 0, 0, 0);
        if (f.deadline === "overdue") {
          if (d.getTime() >= now.getTime() || t.status === "done") return false;
        } else if (f.deadline === "today") {
          if (d.getTime() !== now.getTime()) return false;
        } else if (f.deadline === "week") {
          if (d.getTime() < now.getTime() || d.getTime() > endOfWeek.getTime())
            return false;
        } else if (f.deadline === "month") {
          if (d.getTime() < now.getTime() || d.getTime() > endOfMonth.getTime())
            return false;
        }
      }
    }

    return true;
  });
}
