"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  groupPortalTasks,
  isTaskOverdue,
  taskMatchesQuery,
  taskStatusLabel,
  taskStatusTone,
  TASK_STATUSES,
  type PortalTaskLike,
  type PortalProjectGroup,
} from "@/lib/portal/tasks";

function formatDeadline(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function DeadlineLabel({ task, nowIso }: { task: PortalTaskLike; nowIso: string }) {
  const formatted = formatDeadline(task.deadline);
  if (!formatted) return <span className="text-xs text-content-3">Pas d&apos;échéance</span>;
  const overdue = isTaskOverdue(task, nowIso);
  return (
    <span className={cn("text-xs", overdue ? "font-medium text-danger" : "text-content-3")}>
      {formatted}
      {overdue && <span className="ml-1">· en retard</span>}
    </span>
  );
}

function SubtaskRow({ task, nowIso }: { task: PortalTaskLike; nowIso: string }) {
  const done = task.status === "done";
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 pl-2">
      <span className={cn("min-w-0 flex-1 text-sm", done ? "text-content-3 line-through" : "text-content-2")}>
        {task.title}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        <DeadlineLabel task={task} nowIso={nowIso} />
        <Badge tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</Badge>
      </div>
    </li>
  );
}

function ParentTaskRow({
  task,
  subtasks,
  expanded,
  onToggle,
  nowIso,
}: {
  task: PortalTaskLike;
  subtasks: PortalTaskLike[];
  expanded: boolean;
  onToggle: () => void;
  nowIso: string;
}) {
  const hasSubtasks = subtasks.length > 0;
  const doneCount = subtasks.filter((s) => s.status === "done").length;
  const panelId = `portal-subtasks-${task.id}`;

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 py-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {hasSubtasks ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={panelId}
              aria-label={expanded ? "Réduire les sous-tâches" : "Déplier les sous-tâches"}
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-content-3 transition-transform duration-2 ease-ac hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2"
            >
              <ChevronRight size={14} className={cn("transition-transform duration-2 ease-ac", expanded && "rotate-90")} />
            </button>
          ) : (
            <span className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-content">{task.title}</p>
            {task.description && (
              <p className="mt-0.5 text-xs leading-relaxed text-content-2">{task.description}</p>
            )}
            {hasSubtasks && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round((doneCount / subtasks.length) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-content-3">
                  {doneCount}/{subtasks.length} sous-tâches
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 pl-7 sm:pl-0">
          <DeadlineLabel task={task} nowIso={nowIso} />
          <Badge tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</Badge>
        </div>
      </div>
      {hasSubtasks && expanded && (
        <ul id={panelId} className="ml-7 space-y-0 divide-y divide-line border-l border-line pb-2 pl-4">
          {subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} task={subtask} nowIso={nowIso} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ProjectSection({
  group,
  nowIso,
  expandedProject,
  onToggleProject,
  expandedParents,
  onToggleParent,
  visibleParentIds,
  visibleSubtasksByParent,
  forceOpen,
}: {
  group: PortalProjectGroup;
  nowIso: string;
  expandedProject: boolean;
  onToggleProject: () => void;
  expandedParents: Set<string>;
  onToggleParent: (id: string) => void;
  visibleParentIds: Set<string>;
  visibleSubtasksByParent: Map<string, PortalTaskLike[]>;
  forceOpen: boolean;
}) {
  const parents = group.parents.filter((p) => visibleParentIds.has(p.id));
  const open = forceOpen || expandedProject;

  return (
    <section className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={onToggleProject}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 focus-visible:ring-inset"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronRight size={14} className={cn("shrink-0 text-content-3 transition-transform duration-2 ease-ac", open && "rotate-90")} />
          <h3 className="truncate text-sm font-semibold text-content">{group.projectName}</h3>
          {group.isActive ? (
            <Badge tone="blue" dot="pulse">En cours</Badge>
          ) : (
            <Badge tone="slate">Terminé</Badge>
          )}
        </div>
        <span className="shrink-0 text-xs text-content-3">
          {group.doneCount}/{group.totalCount} tâches
        </span>
      </button>
      {open && (
        <ul className="border-t border-line px-4">
          {parents.map((parent) => (
            <ParentTaskRow
              key={parent.id}
              task={parent}
              subtasks={visibleSubtasksByParent.get(parent.id) ?? []}
              expanded={forceOpen || expandedParents.has(parent.id)}
              onToggle={() => onToggleParent(parent.id)}
              nowIso={nowIso}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function TaskWorkspace({ tasks, nowIso }: { tasks: PortalTaskLike[]; nowIso: string }) {
  const groups = useMemo(() => groupPortalTasks(tasks), [tasks]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(groups.filter((g) => g.isActive).map((g) => g.projectId)),
  );
  const [expandedParents, setExpandedParents] = useState<Set<string>>(
    () => new Set(groups.filter((g) => g.isActive).flatMap((g) => g.parents.map((p) => p.id))),
  );
  const [archiveOpen, setArchiveOpen] = useState(false);

  function toggleProject(id: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleParent(id: string) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filterActive = query.trim() !== "" || statusFilter !== "all" || projectFilter !== "all";

  function taskPasses(task: PortalTaskLike) {
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    return taskMatchesQuery(task, query);
  }

  const activeGroups = groups.filter((g) => g.isActive);
  const archivedGroups = groups.filter((g) => !g.isActive);

  const groupsToShow = filterActive
    ? groups.filter((g) => projectFilter === "all" || g.projectId === projectFilter)
    : projectFilter === "all"
      ? activeGroups
      : groups.filter((g) => g.projectId === projectFilter && g.isActive);

  function buildVisibility(group: PortalProjectGroup) {
    const visibleParentIds = new Set<string>();
    const visibleSubtasksByParent = new Map<string, PortalTaskLike[]>();
    for (const parent of group.parents) {
      const subs = group.subtasksByParent[parent.id] ?? [];
      if (!filterActive) {
        visibleParentIds.add(parent.id);
        visibleSubtasksByParent.set(parent.id, subs);
        continue;
      }
      const matchingSubs = subs.filter(taskPasses);
      const selfMatches = taskPasses(parent);
      if (selfMatches || matchingSubs.length > 0) {
        visibleParentIds.add(parent.id);
        visibleSubtasksByParent.set(parent.id, selfMatches ? subs : matchingSubs);
      }
    }
    return { visibleParentIds, visibleSubtasksByParent };
  }

  const visibleGroups = groupsToShow
    .map((group) => ({ group, ...buildVisibility(group) }))
    .filter(({ visibleParentIds }) => visibleParentIds.size > 0);

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<ChevronRight />}
        title="Aucune tâche partagée"
        description="Vos prochaines étapes apparaîtront ici dès qu'un projet démarre."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-3" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une tâche…"
            aria-label="Rechercher une tâche"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrer par statut"
          className="h-9 w-auto min-w-[150px] text-sm"
        >
          <option value="all">Tous les statuts</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {taskStatusLabel(s)}
            </option>
          ))}
        </Select>
        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label="Filtrer par projet"
          className="h-9 w-auto min-w-[170px] text-sm"
        >
          <option value="all">Tous les projets</option>
          {groups.map((g) => (
            <option key={g.projectId} value={g.projectId}>
              {g.projectName}
            </option>
          ))}
        </Select>
      </div>

      {visibleGroups.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Aucune tâche ne correspond"
          description="Essayez un autre mot-clé ou réinitialisez les filtres."
          size="sm"
        />
      ) : (
        <div className="space-y-3">
          {visibleGroups.map(({ group, visibleParentIds, visibleSubtasksByParent }) => (
            <ProjectSection
              key={group.projectId}
              group={group}
              nowIso={nowIso}
              expandedProject={expandedProjects.has(group.projectId)}
              onToggleProject={() => toggleProject(group.projectId)}
              expandedParents={expandedParents}
              onToggleParent={toggleParent}
              visibleParentIds={visibleParentIds}
              visibleSubtasksByParent={visibleSubtasksByParent}
              forceOpen={filterActive}
            />
          ))}
        </div>
      )}

      {!filterActive && archivedGroups.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setArchiveOpen((v) => !v)}
            aria-expanded={archiveOpen}
            className="flex items-center gap-2 rounded-md px-1 py-1.5 text-xs font-medium text-content-3 transition-colors duration-2 ease-ac hover:text-content-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2"
          >
            <Archive size={13} />
            <ChevronRight size={12} className={cn("transition-transform duration-2 ease-ac", archiveOpen && "rotate-90")} />
            Projets terminés ({archivedGroups.length})
          </button>
          {archiveOpen && (
            <div className="mt-2 space-y-3">
              {archivedGroups.map((group) => {
                const { visibleParentIds, visibleSubtasksByParent } = buildVisibility(group);
                return (
                  <ProjectSection
                    key={group.projectId}
                    group={group}
                    nowIso={nowIso}
                    expandedProject={expandedProjects.has(group.projectId)}
                    onToggleProject={() => toggleProject(group.projectId)}
                    expandedParents={expandedParents}
                    onToggleParent={toggleParent}
                    visibleParentIds={visibleParentIds}
                    visibleSubtasksByParent={visibleSubtasksByParent}
                    forceOpen={false}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
