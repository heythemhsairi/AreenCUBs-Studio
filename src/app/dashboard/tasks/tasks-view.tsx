"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { TasksKanban, type TaskCard } from "./tasks-kanban";
import { TasksList } from "./tasks-list";
import {
  TasksToolbar,
  DEFAULT_FILTERS,
  type TasksFilters,
} from "./tasks-toolbar";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  List,
  Calendar,
  Plus,
  Filter,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Option = { value: string; label: string };
type ViewMode = "kanban" | "list" | "calendar";

type QuickFilter =
  | "active"
  | "today"
  | "overdue"
  | "this_week"
  | "in_progress"
  | "review"
  | "my_tasks"
  | "done";

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "active",      label: "Toutes" },
  { id: "my_tasks",   label: "Mes tâches" },
  { id: "today",      label: "Aujourd'hui" },
  { id: "overdue",    label: "En retard" },
  { id: "this_week",  label: "Cette semaine" },
  { id: "review",     label: "En révision" },
  { id: "done",       label: "Terminées" },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
  const [view, setView] = useState<ViewMode>("kanban");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("active");
  const [showFilters, setShowFilters] = useState(false);

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
    setFilters(DEFAULT_FILTERS);
  }

  const activeFilterCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0) +
    (filters.assigneeId !== "all" ? 1 : 0) +
    (filters.projectId !== "all" ? 1 : 0) +
    (filters.deadline !== "all" ? 1 : 0) +
    (filters.search.trim().length > 0 ? 1 : 0);

  return (
    <div className="relative flex flex-col gap-4 pb-20 md:pb-6">
      {/* Page header */}
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

      {/* Top bar: quick filters + view toggle */}
      <div className="flex items-center gap-3">
        {/* Quick filter chip strip — horizontal scroll on mobile */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1.5 pb-0.5">
            {QUICK_FILTERS.map((qf) => {
              const count = qCounts[qf.id];
              const isActive = quickFilter === qf.id;
              const isOverdue = qf.id === "overdue";
              return (
                <button
                  key={qf.id}
                  type="button"
                  onClick={() => selectQuick(qf.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    isActive
                      ? "border-[#22D3EE]/30 bg-[#22D3EE]/10 text-[#22D3EE]"
                      : isOverdue && count > 0
                        ? "border-[#F43F5E]/20 bg-[#F43F5E]/5 text-[#F43F5E]/80 hover:border-[#F43F5E]/40 hover:text-[#F43F5E]"
                        : "border-[#22506F] bg-[#0D2D47] text-[#94A3B8] hover:border-[#22D3EE]/20 hover:text-[#CBD5E1]",
                  )}
                >
                  <span>{qf.label}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0 text-[10px] font-semibold",
                        isActive
                          ? "bg-[#22D3EE]/20 text-[#22D3EE]"
                          : isOverdue
                            ? "bg-[#F43F5E]/10 text-[#F43F5E]"
                            : "bg-[#22506F] text-[#64748B]",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter toggle + view toggle — always visible */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Filter button */}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all",
              showFilters || activeFilterCount > 0
                ? "border-[#22D3EE]/20 bg-[#22D3EE]/10 text-[#22D3EE]"
                : "border-[#22506F] bg-[#0D2D47] text-[#94A3B8] hover:border-[#22506F] hover:text-[#CBD5E1]",
            )}
          >
            <Filter size={13} />
            <span className="hidden sm:inline">Filtres</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#22D3EE]/20 text-[10px] font-bold text-[#22D3EE]">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View toggle: Kanban / List / Calendar */}
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#22506F] bg-[#071B2C]/80 p-0.5">
            <ViewToggleBtn
              icon={<LayoutGrid size={14} />}
              label="Kanban"
              active={view === "kanban"}
              onClick={() => setView("kanban")}
            />
            <ViewToggleBtn
              icon={<List size={14} />}
              label="Liste"
              active={view === "list"}
              onClick={() => setView("list")}
            />
            <ViewToggleBtn
              icon={<Calendar size={14} />}
              label="Calendrier"
              active={view === "calendar"}
              onClick={() => setView("calendar")}
            />
          </div>
        </div>
      </div>

      {/* Collapsible advanced filters toolbar */}
      {showFilters && (
        <TasksToolbar
          filters={filters}
          onChange={setFilters}
          view={view === "kanban" ? "kanban" : "list"}
          onViewChange={() => {}}
          projects={projects}
          assignees={assignees}
          currentUserId={currentUserId}
          resultCount={filtered.length}
        />
      )}

      {/* Main content */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : view === "kanban" ? (
        <DarkKanban
          tasks={filtered}
          tagColors={tagColors}
        />
      ) : view === "calendar" ? (
        <CalendarPlaceholder />
      ) : (
        <DarkList tasks={filtered} tagColors={tagColors} />
      )}

      {/* Mobile sticky "Add task" button */}
      {!isFreelancer && (
        <div className="fixed bottom-6 right-5 z-50 md:hidden">
          <Link href="/dashboard/tasks/new">
            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#22D3EE] text-[#071B2C] shadow-lg shadow-[#22D3EE]/25 transition-all hover:scale-105 hover:bg-[#06B6D4] active:scale-95"
            >
              <Plus size={20} />
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View Toggle Button
// ---------------------------------------------------------------------------

function ViewToggleBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-all",
        active
          ? "bg-[#22D3EE]/10 text-[#22D3EE] border border-[#22D3EE]/20"
          : "text-[#64748B] hover:text-[#94A3B8]",
      )}
    >
      {icon}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Dark Kanban
// ---------------------------------------------------------------------------

type Status = "todo" | "in_progress" | "review" | "done" | "cancelled";
type Priority = "low" | "normal" | "high" | "urgent";

const COLUMN_ORDER: Status[] = ["todo", "in_progress", "review", "done"];

const columnConfig: Record<
  Status,
  { label: string; textColor: string; bgColor: string; dotPulse?: boolean }
> = {
  todo:        { label: "À faire",      textColor: "text-[#64748B]", bgColor: "bg-[#64748B]/10" },
  in_progress: { label: "En cours",     textColor: "text-[#22D3EE]", bgColor: "bg-[#22D3EE]/10", dotPulse: true },
  review:      { label: "En révision",  textColor: "text-[#A78BFA]", bgColor: "bg-[#A78BFA]/10" },
  done:        { label: "Terminé",      textColor: "text-[#22C55E]", bgColor: "bg-[#22C55E]/10" },
  cancelled:   { label: "Annulé",       textColor: "text-[#F43F5E]", bgColor: "bg-[#F43F5E]/10" },
};

const priorityConfig: Record<
  Priority,
  { tone: "slate" | "blue" | "amber" | "red"; label: string }
> = {
  low:    { tone: "slate", label: "Faible" },
  normal: { tone: "blue",  label: "Normal" },
  high:   { tone: "amber", label: "Élevé" },
  urgent: { tone: "red",   label: "Urgent" },
};

import { changeTaskStatusAction } from "./actions";
import { toast } from "@/components/toast";
import { startTouchDrag } from "@/lib/touch-drag";

function DarkKanban({
  tasks,
  tagColors,
}: {
  tasks: TaskCard[];
  tagColors?: Record<string, string>;
}) {
  const [, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const [override, setOverride] = useState<Record<string, Status>>({});

  function moveTask(taskId: string, to: Status) {
    const task = tasks.find((x) => x.id === taskId);
    if (!task) return;
    const current = (override[taskId] ?? task.status) as Status;
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
    todo: [], in_progress: [], review: [], done: [], cancelled: [],
  };
  for (const task of tasks) {
    const effective = (override[task.id] ?? task.status) as Status;
    grouped[effective].push(task);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMN_ORDER.map((status) => {
        const col = columnConfig[status];
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
              "flex flex-col gap-2 rounded-xl border border-[#22506F] bg-[#071B2C]/50 p-3 transition-all",
              isOver && "border-[#22D3EE]/40 bg-[#22D3EE]/5 ring-1 ring-[#22D3EE]/20",
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-1 py-0.5">
              <div className="flex items-center gap-2">
                {col.dotPulse ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22D3EE] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22D3EE]" />
                  </span>
                ) : (
                  <span className={cn("h-2 w-2 rounded-full", col.bgColor)} />
                )}
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-widest",
                    col.textColor,
                  )}
                >
                  {col.label}
                </span>
              </div>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  col.bgColor,
                  col.textColor,
                )}
              >
                {grouped[status].length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {grouped[status].map((task) => (
                <DarkKanbanCard
                  key={task.id}
                  task={task}
                  effectiveStatus={(override[task.id] ?? task.status) as Status}
                  onMove={moveTask}
                  tagColors={tagColors}
                />
              ))}
              {grouped[status].length === 0 && (
                <div
                  className={cn(
                    "rounded-lg border border-dashed px-3 py-6 text-center text-xs transition-colors",
                    isOver
                      ? "border-[#22D3EE]/30 bg-[#22D3EE]/5 text-[#22D3EE]/60"
                      : "border-[#22506F] text-[#374151]",
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

function DarkKanbanCard({
  task,
  effectiveStatus,
  onMove,
  tagColors,
}: {
  task: TaskCard;
  effectiveStatus: Status;
  onMove: (id: string, to: Status) => void;
  tagColors?: Record<string, string>;
}) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);

  const overdueDays = task.deadline
    ? Math.floor(
        (Date.now() - new Date(task.deadline).getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;
  const isOverdue =
    overdueDays !== null && overdueDays > 0 && effectiveStatus !== "done";

  const pCfg = priorityConfig[task.priority];

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
          onDrop: (zoneId) => zoneId && onMove(task.id, zoneId as Status),
        })
      }
      className={cn(
        "group relative cursor-grab rounded-xl border bg-[#0D2D47] p-3.5 transition-all duration-150",
        "hover:border-[#22D3EE]/30 hover:-translate-y-px active:cursor-grabbing",
        isOverdue ? "border-[#F43F5E]/30" : "border-[#22506F]",
        dragging && "opacity-50",
      )}
    >
      {/* Overdue left indicator */}
      {isOverdue && (
        <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-[#F43F5E]/50" />
      )}

      {/* Title */}
      <Link
        href={`/dashboard/tasks/${task.id}`}
        className="mb-2 block text-sm font-medium text-[#F8FAFC] transition-colors hover:text-[#22D3EE]"
      >
        {task.title}
      </Link>

      {/* Project / client */}
      {task.project && (
        <p className="mb-2.5 text-xs font-medium text-[#64748B]">
          <Link
            href={`/dashboard/projects/${task.project.id}`}
            className="hover:text-[#94A3B8] hover:underline"
          >
            {task.project.name}
          </Link>
          {task.client && (
            <span className="text-[#3D5068]"> · {task.client.name}</span>
          )}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1">
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
                className="rounded-md bg-[#22D3EE]/8 px-1.5 py-0.5 text-[10px] font-medium text-[#22D3EE]/70"
              >
                #{tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Bottom row: priority + due date + assignee */}
      <div className="flex items-center justify-between gap-2">
        <Badge tone={pCfg.tone}>{pCfg.label}</Badge>

        <div className="flex items-center gap-1.5">
          {task.estimated_minutes != null && (
            <span className="rounded-md bg-[#1A3E5C] px-1.5 py-0.5 text-[10px] font-medium text-[#64748B]">
              ~{task.estimated_minutes >= 60
                ? `${Math.round(task.estimated_minutes / 60)}h`
                : `${task.estimated_minutes}m`}
            </span>
          )}
          {task.deadline && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                isOverdue
                  ? "bg-[#F43F5E]/10 text-[#F43F5E]"
                  : "bg-[#1A3E5C] text-[#64748B]",
              )}
            >
              {isOverdue && "⚠ "}
              {new Date(task.deadline).toLocaleDateString("fr-FR", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {task.assignee && (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[#22D3EE]/15 text-[9px] font-bold text-[#22D3EE]"
              title={task.assignee}
            >
              {task.assignee.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Status selector */}
      <select
        value={effectiveStatus}
        onChange={(e) => {
          const s = e.target.value as Status;
          if (s !== effectiveStatus) onMove(task.id, s);
        }}
        onClick={(e) => e.stopPropagation()}
        className="mt-2.5 w-full rounded-lg border border-[#22506F] bg-[#071B2C]/70 px-2 py-1.5 text-xs text-[#64748B] transition-colors focus:border-[#22D3EE]/40 focus:outline-none focus:ring-1 focus:ring-[#22D3EE]/20"
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

// ---------------------------------------------------------------------------
// Dark List (mobile cards + desktop table)
// ---------------------------------------------------------------------------

function DarkList({
  tasks,
  tagColors,
}: {
  tasks: TaskCard[];
  tagColors?: Record<string, string>;
}) {
  const { t } = useI18n();

  return (
    <>
      {/* Mobile: card stack */}
      <div className="flex flex-col gap-2 md:hidden">
        {tasks.map((task) => {
          const overdueDays = task.deadline
            ? Math.floor(
                (Date.now() - new Date(task.deadline).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null;
          const isOverdue =
            overdueDays !== null &&
            overdueDays > 0 &&
            task.status !== "done";
          const pCfg = priorityConfig[task.priority as Priority];

          return (
            <div
              key={task.id}
              className={cn(
                "rounded-xl border bg-[#0D2D47] p-4 transition-all",
                isOverdue ? "border-[#F43F5E]/20" : "border-[#22506F]",
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <Link
                  href={`/dashboard/tasks/${task.id}`}
                  className="text-sm font-medium text-[#F8FAFC] hover:text-[#22D3EE]"
                >
                  {task.title}
                </Link>
                <StatusBadge status={task.status} type="task" />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#64748B]">
                  {task.project?.name ?? "—"}
                </span>
                {task.assignee && (
                  <span className="text-[#64748B]">· {task.assignee}</span>
                )}
                <Badge tone={pCfg.tone}>{pCfg.label}</Badge>
                {task.deadline && (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                      isOverdue
                        ? "bg-[#F43F5E]/10 text-[#F43F5E]"
                        : "bg-[#1A3E5C] text-[#64748B]",
                    )}
                  >
                    {isOverdue && "⚠ "}
                    {new Date(task.deadline).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: compact table */}
      <div className="hidden overflow-hidden rounded-xl border border-[#22506F] bg-[#071B2C]/50 md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#22506F] bg-[#071B2C]">
              <tr className="text-left">
                {["Tâche", "Assigné", "Statut", "Priorité", "Échéance", "Projet"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const overdueDays = task.deadline
                  ? Math.floor(
                      (Date.now() - new Date(task.deadline).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : null;
                const isOverdue =
                  overdueDays !== null &&
                  overdueDays > 0 &&
                  task.status !== "done";
                const pCfg = priorityConfig[task.priority as Priority];

                return (
                  <tr
                    key={task.id}
                    className="h-12 border-b border-[#1A3E5C] transition-colors last:border-0 hover:bg-[#0D2D47]"
                  >
                    {/* Title */}
                    <td className="max-w-[260px] px-4 py-2 align-middle">
                      <Link
                        href={`/dashboard/tasks/${task.id}`}
                        className="block truncate font-medium text-[#E2E8F0] hover:text-[#22D3EE]"
                      >
                        {task.title}
                      </Link>
                      {task.tags && task.tags.length > 0 && (
                        <div className="mt-0.5 flex gap-1">
                          {task.tags.slice(0, 3).map((tag) => {
                            const c = tagColors?.[tag];
                            return c ? (
                              <span
                                key={tag}
                                className="rounded px-1 py-0 text-[9px] font-semibold text-white"
                                style={{ backgroundColor: c }}
                              >
                                #{tag}
                              </span>
                            ) : (
                              <span
                                key={tag}
                                className="rounded bg-[#22D3EE]/8 px-1 py-0 text-[9px] font-medium text-[#22D3EE]/70"
                              >
                                #{tag}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Assignee */}
                    <td className="px-4 py-2 align-middle">
                      {task.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22D3EE]/15 text-[10px] font-bold text-[#22D3EE]">
                            {task.assignee.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate text-xs text-[#94A3B8]">
                            {task.assignee}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#374151]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2 align-middle">
                      <StatusBadge status={task.status} type="task" />
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-2 align-middle">
                      <Badge tone={pCfg.tone}>{pCfg.label}</Badge>
                    </td>

                    {/* Due date */}
                    <td className="px-4 py-2 align-middle">
                      {task.deadline ? (
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                            isOverdue
                              ? "bg-[#F43F5E]/10 text-[#F43F5E]"
                              : "bg-[#1A3E5C] text-[#64748B]",
                          )}
                        >
                          {isOverdue && "⚠ "}
                          {new Date(task.deadline).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-[#374151]">—</span>
                      )}
                    </td>

                    {/* Project */}
                    <td className="px-4 py-2 align-middle">
                      <span className="text-xs text-[#64748B]">
                        {task.project?.name ?? "—"}
                      </span>
                      {task.client && (
                        <span className="block text-[11px] text-[#3D5068]">
                          {task.client.name}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Calendar placeholder
// ---------------------------------------------------------------------------

function CalendarPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#22506F] bg-[#071B2C]/50 px-6 py-20 text-center">
      <Calendar size={32} className="text-[#374151]" />
      <p className="text-sm font-medium text-[#64748B]">Vue calendrier</p>
      <p className="max-w-sm text-xs text-[#374151]">
        La vue calendrier sera disponible prochainement.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#22506F] bg-[#071B2C]/50 px-6 py-16 text-center">
      <span className="text-3xl">🔍</span>
      <p className="text-sm font-medium text-[#94A3B8]">{t.tasksUi.noResults}</p>
      <p className="max-w-sm text-xs text-[#64748B]">{t.tasksUi.noResultsHint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick filter logic (unchanged from original)
// ---------------------------------------------------------------------------

function applyQuickFilter(
  tasks: TaskCard[],
  qf: QuickFilter,
  meId: string,
): TaskCard[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
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

// ---------------------------------------------------------------------------
// Advanced filter logic (unchanged from original)
// ---------------------------------------------------------------------------

function applyFilters(
  tasks: TaskCard[],
  f: TasksFilters,
  meId: string,
): TaskCard[] {
  const q = f.search.trim().toLowerCase();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
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
