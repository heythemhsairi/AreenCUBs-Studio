"use client";

import { useMemo, useState } from "react";
import { TasksKanban, type TaskCard } from "./tasks-kanban";
import { TasksList } from "./tasks-list";
import {
  TasksToolbar,
  DEFAULT_FILTERS,
  type TasksFilters,
  type View,
} from "./tasks-toolbar";

type Option = { value: string; label: string };

export function TasksView({
  tasks,
  projects,
  assignees,
  currentUserId,
  currentUserAssigneeId,
  tagColors,
}: {
  tasks: TaskCard[];
  projects: Option[];
  assignees: Option[];
  currentUserId: string;
  currentUserAssigneeId: string;
  tagColors?: Record<string, string>;
}) {
  const [filters, setFilters] = useState<TasksFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<View>("kanban");

  const filtered = useMemo(
    () => applyFilters(tasks, filters, currentUserAssigneeId),
    [tasks, filters, currentUserAssigneeId],
  );

  return (
    <div className="space-y-4">
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

function EmptyState() {
  return (
    <div className="glass flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-16 text-center">
      <span className="text-3xl">🔍</span>
      <p className="text-sm font-medium text-ink">Aucune tâche ne correspond</p>
      <p className="max-w-sm text-xs text-ink/55">
        Essayez d&apos;élargir vos filtres ou videz la recherche.
      </p>
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
