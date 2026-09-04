/**
 * Pure helpers for the client portal's task workspace.
 *
 * No Supabase, no React — grouping, search and "is this late" are ordinary
 * data transforms over rows already scoped by `portal_tasks`. Kept framework
 * free so they are exercised directly in `tasks.test.ts` without a DOM.
 */

export type PortalTaskLike = {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  projectName: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
};

/**
 * A project reads as "done" once every task inside it — parent or subtask —
 * has left the active workflow. `cancelled` counts as closed alongside
 * `done`: a cancelled task is not something the client is still waiting on.
 */
const CLOSED_STATUSES = new Set(["done", "cancelled"]);

export function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.has(status);
}

export type PortalProjectGroup = {
  projectId: string;
  projectName: string;
  /** Top-level tasks only — parentTaskId is null. */
  parents: PortalTaskLike[];
  /** Subtasks, keyed by their parent's id. */
  subtasksByParent: Record<string, PortalTaskLike[]>;
  totalCount: number;
  doneCount: number;
  /** False once every task in the project is done or cancelled. */
  isActive: boolean;
  /** Earliest deadline among the project's still-open tasks, if any. */
  nextDeadline: string | null;
};

/**
 * Groups a flat `portal_tasks` result by project, splits each group into
 * parents/subtasks, and orders active projects first (soonest open deadline
 * first) with fully-closed projects trailing in their original order — the
 * archive the UI collapses by default.
 */
export function groupPortalTasks(tasks: PortalTaskLike[]): PortalProjectGroup[] {
  const byProject = new Map<string, PortalTaskLike[]>();
  const order: string[] = [];
  for (const task of tasks) {
    if (!byProject.has(task.projectId)) {
      byProject.set(task.projectId, []);
      order.push(task.projectId);
    }
    byProject.get(task.projectId)!.push(task);
  }

  const groups: PortalProjectGroup[] = order.map((projectId) => {
    const all = byProject.get(projectId)!;
    const projectName = all[0].projectName;
    const parents = all.filter((task) => !task.parentTaskId);
    const subtasksByParent: Record<string, PortalTaskLike[]> = {};
    for (const task of all) {
      if (task.parentTaskId) {
        (subtasksByParent[task.parentTaskId] ??= []).push(task);
      }
    }
    const doneCount = all.filter((task) => task.status === "done").length;
    const isActive = all.some((task) => !isClosedStatus(task.status));
    const openDeadlines = all
      .filter((task) => !isClosedStatus(task.status) && task.deadline)
      .map((task) => task.deadline as string)
      .sort();

    return {
      projectId,
      projectName,
      parents,
      subtasksByParent,
      totalCount: all.length,
      doneCount,
      isActive,
      nextDeadline: openDeadlines[0] ?? null,
    };
  });

  const active = groups
    .filter((group) => group.isActive)
    .sort((a, b) => {
      if (a.nextDeadline && b.nextDeadline) return a.nextDeadline.localeCompare(b.nextDeadline);
      if (a.nextDeadline) return -1;
      if (b.nextDeadline) return 1;
      return 0;
    });
  const archived = groups.filter((group) => !group.isActive);

  return [...active, ...archived];
}

/** True for an open task whose deadline has already passed `nowIso`. */
export function isTaskOverdue(task: PortalTaskLike, nowIso: string): boolean {
  if (!task.deadline || isClosedStatus(task.status)) return false;
  return task.deadline < nowIso.slice(0, 10);
}

/** Case-insensitive substring match over title and description. An empty query matches everything. */
export function taskMatchesQuery(task: PortalTaskLike, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    task.title.toLowerCase().includes(q) ||
    (task.description ?? "").toLowerCase().includes(q)
  );
}

export const TASK_STATUSES = ["todo", "in_progress", "review", "done", "cancelled"] as const;

export function taskStatusLabel(status: string): string {
  switch (status) {
    case "todo":
      return "À faire";
    case "in_progress":
      return "En cours";
    case "review":
      return "En validation";
    case "done":
      return "Terminé";
    case "cancelled":
      return "Annulé";
    default:
      return status;
  }
}

export function taskStatusTone(status: string): "green" | "blue" | "slate" | "amber" {
  if (status === "done") return "green";
  if (status === "in_progress" || status === "review") return "blue";
  if (status === "cancelled") return "slate";
  return "amber";
}
