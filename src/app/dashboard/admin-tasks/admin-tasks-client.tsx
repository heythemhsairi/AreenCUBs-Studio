"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { changeAdminTaskStatusAction } from "./actions";
import { toast } from "@/components/toast";
import type { AdminTask, AdminTaskStatus } from "./types";
import { ADMIN_TASK_STATUSES } from "./types";
import { AlertTriangle, Clock, CheckCircle2, Pause, Ban, Plus } from "lucide-react";

const statusIcon: Record<AdminTaskStatus, React.ReactNode> = {
  todo:        <Clock size={13} className="text-content-3" />,
  in_progress: <Clock size={13} className="text-accent2" />,
  waiting:     <Pause size={13} className="text-warning" />,
  done:        <CheckCircle2 size={13} className="text-success" />,
  cancelled:   <Ban size={13} className="text-content-3" />,
};

type FilterKey = "all" | "active" | "done";

function getDaysUntilDue(due: string | null): number | null {
  if (!due) return null;
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function DueBadge({ due_date }: { due_date: string | null }) {
  const { t } = useI18n();
  const days = getDaysUntilDue(due_date);
  if (days === null) return null;
  if (days < 0)
    return (
      <span className="rounded-md bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
        {t.overview.relativeOverdueLong(Math.abs(days))}
      </span>
    );
  if (days === 0)
    return (
      <span className="rounded-md bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
        {t.overview.relativeTodayLong}
      </span>
    );
  if (days <= 7)
    return (
      <span className="rounded-md bg-info/15 px-2 py-0.5 text-[10px] font-semibold text-info">
        {t.overview.relativeInLong(days)}
      </span>
    );
  return (
    <span className="text-[10px] text-content-3">{formatDate(due_date!)}</span>
  );
}

function StatusQuickChange({
  task,
  onChanged,
}: {
  task: AdminTask;
  onChanged: (id: string, next: AdminTaskStatus) => void;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const at = t.adminTasks;

  function handleChange(next: AdminTaskStatus) {
    if (next === task.status) return;
    onChanged(task.id, next); // optimistic
    startTransition(async () => {
      const res = await changeAdminTaskStatusAction(task.id, next);
      if (!res.ok) {
        onChanged(task.id, task.status); // rollback
        toast.error(res.error);
      }
    });
  }

  return (
    <select
      value={task.status}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value as AdminTaskStatus)}
      onClick={(e) => e.preventDefault()} // don't navigate on click
      className="cursor-pointer rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11px] text-content-2 focus:outline-none focus:border-accent2 disabled:opacity-50"
      aria-label={at.labelStatus}
    >
      {ADMIN_TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {at.status[s]}
        </option>
      ))}
    </select>
  );
}

export function AdminTasksClient({
  tasks: initialTasks,
}: {
  tasks: AdminTask[];
}) {
  const { t } = useI18n();
  const at = t.adminTasks;
  const router = useRouter();
  const [tasks, setTasks] = useState<AdminTask[]>(initialTasks);
  const [filter, setFilter] = useState<FilterKey>("active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  function handleStatusChange(id: string, next: AdminTaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: next } : t)),
    );
  }

  const filtered = tasks.filter((task) => {
    if (filter === "active" && (task.status === "done" || task.status === "cancelled")) return false;
    if (filter === "done" && task.status !== "done") return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const SECTION_LABEL = "text-[10px] font-semibold uppercase tracking-widest text-content-3";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-content">{at.title}</h1>
          <p className="mt-0.5 text-sm text-content-3">{at.description}</p>
        </div>
        <Link
          href="/dashboard/admin-tasks/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent2/10 border border-accent2/30 px-4 py-2 text-sm font-semibold text-accent2 hover:bg-accent2/20 transition-colors"
        >
          <Plus size={14} />
          {at.new}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
          {(["all", "active", "done"] as FilterKey[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                filter === f
                  ? "bg-accent2/10 text-accent2"
                  : "text-content-3 hover:text-content"
              }`}
            >
              {f === "all" ? at.filterAll : f === "active" ? at.filterActive : at.filterDone}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-content-2 focus:outline-none focus:border-accent2"
        >
          <option value="all">{at.labelPriority}: {at.filterAll}</option>
          {(["urgent", "high", "normal", "low"] as const).map((p) => (
            <option key={p} value={p}>{at.priority[p]}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.common.search + "…"}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-content placeholder:text-content-3 focus:outline-none focus:border-accent2 min-w-[160px]"
        />

        <span className="ml-auto text-xs text-content-3">
          {filtered.length} {filtered.length === 1 ? t.common.result : t.common.results}
        </span>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface py-16 text-center">
          <AlertTriangle size={28} className="mx-auto mb-3 text-content-3" />
          <p className="text-sm text-content-3">{at.empty}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="divide-y divide-line">
            {filtered.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
              >
                {/* Status icon */}
                <span className="shrink-0">{statusIcon[task.status]}</span>

                {/* Main content — clickable */}
                <Link
                  href={`/dashboard/admin-tasks/${task.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-sm font-medium text-content group-hover:text-accent2 transition-colors">
                    {task.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {task.related_client_name && (
                      <span className="text-[10px] text-content-3">{task.related_client_name}</span>
                    )}
                    {task.related_project_name && (
                      <span className="text-[10px] text-content-3">· {task.related_project_name}</span>
                    )}
                    {task.assigned_admin_name && (
                      <span className="text-[10px] text-content-3">· @{task.assigned_admin_name}</span>
                    )}
                  </div>
                </Link>

                {/* Right side: badges + status quick-change */}
                <div className="flex shrink-0 items-center gap-2">
                  <DueBadge due_date={task.due_date} />
                  <PriorityBadge priority={task.priority} />
                  <StatusQuickChange task={task} onChanged={handleStatusChange} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
