"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rescheduleTaskAction } from "./actions";
import { toast } from "@/components/toast";
import { startTouchDrag } from "@/lib/touch-drag";

type Status = "todo" | "in_progress" | "review" | "done" | "cancelled";
type Priority = "low" | "normal" | "high" | "urgent";

export type CalendarTask = {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  deadline: string;
  assignee: string | null;
  project: { id: string; name: string } | null;
  tags: string[];
};

export type CompletedEntry = {
  id: string;
  taskId: string;
  title: string;
  project: string | null;
  actor: string | null;
  completedAt: string;
};

type View = "month" | "week" | "agenda";

const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "bg-red-500 text-white",
  high: "bg-accent text-white",
  normal: "bg-brand text-white",
  low: "bg-ink/40 text-white",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgente",
  high: "Haute",
  normal: "Normale",
  low: "Basse",
};

const STATUS_OPACITY: Record<Status, string> = {
  todo: "",
  in_progress: "",
  review: "",
  done: "opacity-50 line-through",
  cancelled: "opacity-40 line-through",
};

const WEEKDAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  // Monday = 1, Sunday = 0 → we want Monday as week start
  const dow = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - dow);
  r.setHours(0, 0, 0, 0);
  return r;
}

function buildMonthGrid(viewDate: Date): Date[] {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = startOfWeek(first);
  // 6 rows × 7 cols = 42 cells
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function buildWeekGrid(viewDate: Date): Date[] {
  const start = startOfWeek(viewDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function CalendarView({
  tasks,
  completed,
}: {
  tasks: CalendarTask[];
  completed: CompletedEntry[];
  currentUserId: string;
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const [view, setView] = useState<View>("month");
  const [viewDate, setViewDate] = useState<Date>(today);
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [pending, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const filteredTasks = useMemo(
    () =>
      tasks
        .map((t) => ({
          ...t,
          deadline: overrides[t.id] ?? t.deadline,
        }))
        .filter((t) => priorityFilter === "all" || t.priority === priorityFilter),
    [tasks, priorityFilter, overrides],
  );

  // Group tasks by deadline (YYYY-MM-DD)
  const tasksByDate = useMemo(() => {
    const map: Record<string, CalendarTask[]> = {};
    for (const t of filteredTasks) {
      const key = t.deadline.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [filteredTasks]);

  const cells = view === "month" ? buildMonthGrid(viewDate) : buildWeekGrid(viewDate);
  const currentMonth = viewDate.getMonth();

  function goPrev() {
    const d = new Date(viewDate);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setViewDate(d);
  }
  function goNext() {
    const d = new Date(viewDate);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setViewDate(d);
  }
  function goToday() {
    setViewDate(today);
  }

  function onDropTask(taskId: string, targetIso: string) {
    const task = filteredTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.deadline.slice(0, 10) === targetIso) return;
    setOverrides((m) => ({ ...m, [taskId]: targetIso }));
    startTransition(async () => {
      const res = await rescheduleTaskAction(taskId, targetIso);
      if (!res.ok) {
        setOverrides((m) => {
          const next = { ...m };
          delete next[taskId];
          return next;
        });
        toast.error(res.error);
      } else {
        toast.success("Tâche replanifiée");
      }
    });
  }

  // Stats for the current month
  const monthStats = useMemo(() => {
    const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    let total = 0;
    let done = 0;
    let overdue = 0;
    for (const t of filteredTasks) {
      const d = new Date(t.deadline);
      if (d < monthStart || d > monthEnd) continue;
      total++;
      if (t.status === "done") done++;
      else if (d.getTime() < today.getTime()) overdue++;
    }
    return { total, done, overdue };
  }, [filteredTasks, viewDate, today]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* Main calendar */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-1">
            <NavBtn onClick={goPrev} label="Précédent" icon="m15 18-6-6 6-6" />
            <button
              type="button"
              onClick={goToday}
              className="rounded-md border border-ink/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:border-brand/30 hover:bg-white"
            >
              Aujourd&apos;hui
            </button>
            <NavBtn onClick={goNext} label="Suivant" icon="m9 18 6-6-6-6" />
          </div>
          <h2 className="ml-2 text-lg font-semibold tracking-tight text-ink">
            {MONTHS_FR[viewDate.getMonth()]} {viewDate.getFullYear()}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as "all" | Priority)
              }
              className="h-9 rounded-lg border border-ink/10 bg-white/70 px-2 text-xs font-medium text-ink/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="all">Toutes priorités</option>
              <option value="urgent">Urgente</option>
              <option value="high">Haute</option>
              <option value="normal">Normale</option>
              <option value="low">Basse</option>
            </select>
            <div className="inline-flex items-center rounded-lg border border-ink/10 bg-white/60 p-0.5">
              <ViewBtn
                active={view === "month"}
                onClick={() => setView("month")}
                label="Mois"
              />
              <ViewBtn
                active={view === "week"}
                onClick={() => setView("week")}
                label="Semaine"
              />
              <ViewBtn
                active={view === "agenda"}
                onClick={() => setView("agenda")}
                label="Agenda"
              />
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Tâches du mois" value={monthStats.total} tone="brand" />
          <Stat label="Terminées" value={monthStats.done} tone="green" />
          <Stat label="En retard" value={monthStats.overdue} tone="red" />
        </div>

        {/* Grid */}
        {view === "agenda" ? (
          <AgendaView
            tasks={filteredTasks}
            today={today}
            onDropTask={onDropTask}
          />
        ) : (
          <div className="glass overflow-hidden rounded-2xl">
            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-ink/8 bg-white/40">
              {WEEKDAYS_FR.map((wd) => (
                <div
                  key={wd}
                  className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55"
                >
                  {wd}
                </div>
              ))}
            </div>
            {/* Cells */}
            <div
              className={cn(
                "grid grid-cols-7",
                view === "month" ? "grid-rows-6" : "grid-rows-1",
              )}
            >
              {cells.map((d) => {
                const iso = isoFromDate(d);
                const dayTasks = tasksByDate[iso] ?? [];
                const isToday = d.getTime() === today.getTime();
                const isOutsideMonth =
                  view === "month" && d.getMonth() !== currentMonth;
                return (
                  <DayCell
                    key={iso}
                    date={d}
                    iso={iso}
                    tasks={dayTasks}
                    isToday={isToday}
                    isOutsideMonth={isOutsideMonth}
                    isWeek={view === "week"}
                    pending={pending}
                    onDropTask={onDropTask}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Side rail */}
      <div className="space-y-4">
        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle>Couleurs par priorité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(["urgent", "high", "normal", "low"] as Priority[]).map((p) => (
              <div key={p} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "h-3 w-3 shrink-0 rounded",
                    PRIORITY_COLOR[p].split(" ")[0],
                  )}
                />
                <span className="text-ink/75">{PRIORITY_LABEL[p]}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recently completed */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="mr-1.5 text-emerald-500">✓</span>
              Récemment terminées
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completed.length === 0 ? (
              <p className="text-xs text-ink/45">
                Aucune tâche terminée récemment.
              </p>
            ) : (
              <ul className="space-y-2">
                {completed.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/tasks/${c.taskId}`}
                      className="block rounded-lg border border-ink/5 bg-white/60 p-2.5 transition-all hover:border-brand/25 hover:bg-white/90 hover:shadow-soft"
                    >
                      <p className="truncate text-sm font-medium text-ink line-through opacity-75">
                        {c.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-ink/55">
                        {c.project ?? "—"}
                        {c.actor && <> · {c.actor}</>}
                        {" · "}
                        {relativeTime(c.completedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AgendaView({
  tasks,
  today,
  onDropTask,
}: {
  tasks: CalendarTask[];
  today: Date;
  onDropTask: (taskId: string, targetIso: string) => void;
}) {
  // Group by deadline date, sorted ascending. Past-due and today get
  // pinned to the top with a tonal accent.
  const groups = useMemo(() => {
    const map: Record<string, CalendarTask[]> = {};
    for (const t of tasks) {
      const k = t.deadline.slice(0, 10);
      if (!map[k]) map[k] = [];
      map[k].push(t);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, items]) => ({ iso, items }));
  }, [tasks]);

  if (groups.length === 0) {
    return (
      <div className="glass flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-16 text-center">
        <span className="text-3xl">📅</span>
        <p className="text-sm font-medium text-ink">Aucune tâche planifiée</p>
        <p className="text-xs text-ink/55">
          Définissez une échéance sur une tâche pour la voir apparaître ici.
        </p>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <ul className="divide-y divide-ink/8">
        {groups.map(({ iso, items }) => {
          const d = new Date(iso);
          d.setHours(0, 0, 0, 0);
          const isPast = d.getTime() < today.getTime();
          const isToday = d.getTime() === today.getTime();
          const dayLabel = d.toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return (
            <li
              key={iso}
              data-drop-zone={iso}
              className={cn(
                "p-4 transition-colors",
                isToday
                  ? "bg-brand/8"
                  : isPast
                    ? "bg-red-50/40 dark:bg-red-500/8"
                    : "bg-white/30",
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                    isToday
                      ? "bg-brand text-white"
                      : isPast
                        ? "bg-red-100 text-red-700"
                        : "bg-ink/5 text-ink/65",
                  )}
                >
                  {isToday ? "Aujourd'hui" : isPast ? "En retard" : dayLabel}
                </span>
                {!isToday && !isPast && (
                  <span className="text-[11px] text-ink/45">{dayLabel}</span>
                )}
                <span className="ml-auto text-[11px] font-semibold text-ink/45">
                  {items.length} tâche{items.length > 1 ? "s" : ""}
                </span>
              </div>
              <ul className="space-y-1.5">
                {items.map((t) => (
                  <li key={t.id}>
                    <AgendaRow task={t} onDropTask={onDropTask} />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AgendaRow({
  task,
  onDropTask,
}: {
  task: CalendarTask;
  onDropTask: (taskId: string, targetIso: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <Link
      href={`/dashboard/tasks/${task.id}`}
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
          onDrop: (zoneId) => zoneId && onDropTask(task.id, zoneId),
        })
      }
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-ink/8 bg-white p-2.5 transition-all hover:border-brand/30 hover:shadow-soft dark:bg-white/5 cursor-grab active:cursor-grabbing",
        dragging && "opacity-50",
        STATUS_OPACITY[task.status],
      )}
    >
      <span
        className={cn(
          "h-7 w-1 shrink-0 rounded-full",
          PRIORITY_COLOR[task.priority].split(" ")[0],
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink group-hover:text-brand">
          {task.title}
        </p>
        <p className="truncate text-[11px] text-ink/55">
          {task.project?.name ?? "—"}
          {task.assignee && <> · {task.assignee}</>}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white",
          PRIORITY_COLOR[task.priority].split(" ")[0],
        )}
      >
        {PRIORITY_LABEL[task.priority]}
      </span>
    </Link>
  );
}

function DayCell({
  date,
  iso,
  tasks,
  isToday,
  isOutsideMonth,
  isWeek,
  pending,
  onDropTask,
}: {
  date: Date;
  iso: string;
  tasks: CalendarTask[];
  isToday: boolean;
  isOutsideMonth: boolean;
  isWeek: boolean;
  pending: boolean;
  onDropTask: (taskId: string, targetIso: string) => void;
}) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      data-drop-zone={iso}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("text/task-id");
        setIsOver(false);
        if (taskId) onDropTask(taskId, iso);
      }}
      className={cn(
        "relative flex flex-col gap-1 border-b border-r border-ink/8 p-1.5 transition-colors",
        isWeek ? "min-h-[440px]" : "min-h-[110px]",
        isOutsideMonth ? "bg-white/15 text-ink/35" : "bg-white/40",
        isOver && "bg-brand/8 ring-2 ring-inset ring-brand/40",
        pending && "opacity-90",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
            isToday
              ? "bg-brand text-white"
              : isOutsideMonth
                ? "text-ink/40"
                : "text-ink/70",
          )}
        >
          {date.getDate()}
        </span>
        {tasks.length > 0 && (
          <span className="text-[10px] font-semibold text-ink/45">
            {tasks.length}
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {tasks.slice(0, isWeek ? 30 : 4).map((t) => (
          <li key={t.id}>
            <TaskChip task={t} onDropTask={onDropTask} />
          </li>
        ))}
        {!isWeek && tasks.length > 4 && (
          <li className="px-1 text-[10px] font-medium text-ink/50">
            +{tasks.length - 4} de plus
          </li>
        )}
      </ul>
    </div>
  );
}

function TaskChip({
  task,
  onDropTask,
}: {
  task: CalendarTask;
  onDropTask: (taskId: string, targetIso: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <Link
      href={`/dashboard/tasks/${task.id}`}
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
          onDrop: (zoneId) => zoneId && onDropTask(task.id, zoneId),
        })
      }
      className={cn(
        "block truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-medium shadow-sm transition-all hover:shadow-soft cursor-grab active:cursor-grabbing",
        PRIORITY_COLOR[task.priority],
        STATUS_OPACITY[task.status],
        dragging && "opacity-50",
      )}
      title={`${task.title}${task.project ? ` · ${task.project.name}` : ""}`}
    >
      {task.title}
    </Link>
  );
}

function NavBtn({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-ink/10 bg-white/70 text-ink/65 transition-colors hover:border-brand/30 hover:bg-white hover:text-brand"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon} />
      </svg>
    </button>
  );
}

function ViewBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-7 rounded-md px-3 text-xs font-medium transition-all",
        active
          ? "bg-brand text-white shadow-sm"
          : "text-ink/60 hover:bg-white/80 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "green" | "red";
}) {
  const toneClass =
    tone === "brand"
      ? "from-brand/15 to-brand/5 text-brand-dark"
      : tone === "green"
        ? "from-emerald-100 to-emerald-50 text-emerald-700"
        : "from-red-100 to-red-50 text-red-700";
  return (
    <div
      className={cn(
        "rounded-2xl bg-gradient-to-br px-4 py-3 ring-1 ring-ink/5",
        toneClass,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-2xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
