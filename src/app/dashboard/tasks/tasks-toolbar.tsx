"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type TasksFilters = {
  search: string;
  status: "all" | "todo" | "in_progress" | "review" | "done" | "cancelled";
  priority: "all" | "low" | "normal" | "high" | "urgent";
  assigneeId: string; // "all" | "me" | "unassigned" | <profile id>
  projectId: string; // "all" | <project id>
  deadline: "all" | "overdue" | "today" | "week" | "month" | "none";
};

export type View = "kanban" | "list";

export const DEFAULT_FILTERS: TasksFilters = {
  search: "",
  status: "all",
  priority: "all",
  assigneeId: "all",
  projectId: "all",
  deadline: "all",
};

type Option = { value: string; label: string };

export function TasksToolbar({
  filters,
  onChange,
  view,
  onViewChange,
  projects,
  assignees,
  currentUserId,
  resultCount,
}: {
  filters: TasksFilters;
  onChange: (next: TasksFilters) => void;
  view: View;
  onViewChange: (v: View) => void;
  projects: Option[];
  assignees: Option[];
  currentUserId: string;
  resultCount: number;
}) {
  function patch<K extends keyof TasksFilters>(key: K, value: TasksFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const activeCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0) +
    (filters.assigneeId !== "all" ? 1 : 0) +
    (filters.projectId !== "all" ? 1 : 0) +
    (filters.deadline !== "all" ? 1 : 0) +
    (filters.search.trim().length > 0 ? 1 : 0);

  function clearAll() {
    onChange({ ...DEFAULT_FILTERS });
  }

  return (
    <div className="glass rounded-2xl px-4 py-3 md:px-5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => patch("search", e.target.value)}
            placeholder="Rechercher une tâche…"
            className="w-full rounded-lg border border-ink/10 bg-white/70 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {/* Status menu */}
        <FilterMenu
          label="Statut"
          value={filters.status}
          options={[
            { value: "all", label: "Tous" },
            { value: "todo", label: "À faire" },
            { value: "in_progress", label: "En cours" },
            { value: "review", label: "À valider" },
            { value: "done", label: "Terminé" },
            { value: "cancelled", label: "Annulé" },
          ]}
          onChange={(v) => patch("status", v as TasksFilters["status"])}
        />

        {/* Priority menu */}
        <FilterMenu
          label="Priorité"
          value={filters.priority}
          options={[
            { value: "all", label: "Toutes" },
            { value: "urgent", label: "Urgente" },
            { value: "high", label: "Haute" },
            { value: "normal", label: "Normale" },
            { value: "low", label: "Basse" },
          ]}
          onChange={(v) => patch("priority", v as TasksFilters["priority"])}
        />

        {/* Deadline preset */}
        <FilterMenu
          label="Échéance"
          value={filters.deadline}
          options={[
            { value: "all", label: "Toutes" },
            { value: "overdue", label: "En retard" },
            { value: "today", label: "Aujourd'hui" },
            { value: "week", label: "Cette semaine" },
            { value: "month", label: "Ce mois" },
            { value: "none", label: "Sans échéance" },
          ]}
          onChange={(v) => patch("deadline", v as TasksFilters["deadline"])}
        />

        {/* Assignee */}
        <FilterMenu
          label="Assigné"
          value={filters.assigneeId}
          options={[
            { value: "all", label: "Tout le monde" },
            { value: "me", label: "Moi" },
            { value: "unassigned", label: "Non assigné" },
            ...assignees.filter((a) => a.value !== currentUserId),
          ]}
          onChange={(v) => patch("assigneeId", v)}
        />

        {/* Project */}
        <FilterMenu
          label="Projet"
          value={filters.projectId}
          options={[{ value: "all", label: "Tous les projets" }, ...projects]}
          onChange={(v) => patch("projectId", v)}
        />

        {/* Spacer */}
        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md px-2 py-1 text-xs font-medium text-ink/60 transition-colors hover:bg-white/60 hover:text-ink"
            >
              Effacer ({activeCount})
            </button>
          )}
          <span className="rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/65">
            {resultCount} {resultCount > 1 ? "tâches" : "tâche"}
          </span>

          {/* View toggle */}
          <div className="inline-flex items-center rounded-lg border border-ink/10 bg-white/60 p-0.5">
            <ViewButton
              active={view === "kanban"}
              onClick={() => onViewChange("kanban")}
              label="Kanban"
              icon="M4 6h4v14H4z M10 6h4v8h-4z M16 6h4v11h-4z"
            />
            <ViewButton
              active={view === "list"}
              onClick={() => onViewChange("list")}
              label="Liste"
              icon="M4 6h16 M4 12h16 M4 18h16"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
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
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-all",
        active
          ? "bg-brand text-white shadow-sm"
          : "text-ink/60 hover:bg-white/80 hover:text-ink",
      )}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon} />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const isActive = value !== "all";

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
          isActive
            ? "border-brand/40 bg-brand/10 text-brand-dark"
            : "border-ink/10 bg-white/70 text-ink/70 hover:border-ink/20 hover:bg-white/95",
        )}
      >
        <span className="text-ink/50">{label}:</span>
        <span className="font-semibold">{selected?.label ?? "Tous"}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 min-w-[180px] overflow-hidden rounded-lg border border-ink/8 bg-white/95 shadow-lift backdrop-blur dark:bg-ink/95">
          <ul className="max-h-64 overflow-y-auto py-1">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors",
                    opt.value === value
                      ? "bg-brand/10 font-semibold text-brand-dark"
                      : "text-ink/75 hover:bg-ink/5",
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.value === value && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
