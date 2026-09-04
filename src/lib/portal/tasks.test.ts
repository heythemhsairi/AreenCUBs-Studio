import { describe, expect, it } from "vitest";
import {
  groupPortalTasks,
  isTaskOverdue,
  taskMatchesQuery,
  type PortalTaskLike,
} from "./tasks";

function task(overrides: Partial<PortalTaskLike> & { id: string }): PortalTaskLike {
  return {
    projectId: "proj-1",
    parentTaskId: null,
    projectName: "WejdenSpire — Marketing Septembre 2026",
    title: "Untitled",
    description: null,
    status: "todo",
    deadline: null,
    ...overrides,
  };
}

describe("groupPortalTasks", () => {
  it("splits parents from subtasks within a project", () => {
    const groups = groupPortalTasks([
      task({ id: "p1", title: "Parent" }),
      task({ id: "s1", parentTaskId: "p1", title: "Sub" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].parents.map((t) => t.id)).toEqual(["p1"]);
    expect(groups[0].subtasksByParent["p1"].map((t) => t.id)).toEqual(["s1"]);
  });

  it("marks a project active while any task remains open", () => {
    const groups = groupPortalTasks([
      task({ id: "p1", status: "in_progress" }),
      task({ id: "p2", status: "done" }),
    ]);
    expect(groups[0].isActive).toBe(true);
  });

  it("marks a project archived only once every task is done or cancelled", () => {
    const groups = groupPortalTasks([
      task({ id: "p1", status: "done" }),
      task({ id: "s1", parentTaskId: "p1", status: "cancelled" }),
    ]);
    expect(groups[0].isActive).toBe(false);
  });

  it("sorts active projects before archived ones, regardless of input order", () => {
    const groups = groupPortalTasks([
      task({ id: "a1", projectId: "old", projectName: "Old project", status: "done" }),
      task({ id: "b1", projectId: "new", projectName: "New project", status: "todo", deadline: "2026-09-10" }),
    ]);
    expect(groups.map((g) => g.projectId)).toEqual(["new", "old"]);
  });

  it("orders active projects by their nearest open deadline", () => {
    const groups = groupPortalTasks([
      task({ id: "a1", projectId: "later", projectName: "Later", deadline: "2026-12-01" }),
      task({ id: "b1", projectId: "sooner", projectName: "Sooner", deadline: "2026-09-05" }),
    ]);
    expect(groups.map((g) => g.projectId)).toEqual(["sooner", "later"]);
  });

  it("ignores closed tasks when computing the next deadline", () => {
    const groups = groupPortalTasks([
      task({ id: "a1", status: "done", deadline: "2026-01-01" }),
      task({ id: "a2", status: "todo", deadline: "2026-10-01" }),
    ]);
    expect(groups[0].nextDeadline).toBe("2026-10-01");
  });
});

describe("isTaskOverdue", () => {
  const now = "2026-09-04T12:00:00.000Z";

  it("is true for an open task whose deadline has passed", () => {
    expect(isTaskOverdue(task({ id: "t1", deadline: "2026-09-01" }), now)).toBe(true);
  });

  it("is false for a future deadline", () => {
    expect(isTaskOverdue(task({ id: "t1", deadline: "2026-09-10" }), now)).toBe(false);
  });

  it("is false once the task is done, even if the deadline passed", () => {
    expect(isTaskOverdue(task({ id: "t1", deadline: "2026-01-01", status: "done" }), now)).toBe(false);
  });

  it("is false when there is no deadline", () => {
    expect(isTaskOverdue(task({ id: "t1", deadline: null }), now)).toBe(false);
  });
});

describe("taskMatchesQuery", () => {
  it("matches on title, case-insensitively", () => {
    expect(taskMatchesQuery(task({ id: "t1", title: "Tournage Réel" }), "réel")).toBe(true);
  });

  it("matches on description", () => {
    expect(taskMatchesQuery(task({ id: "t1", title: "X", description: "Brief marketing" }), "brief")).toBe(true);
  });

  it("returns true for an empty or whitespace-only query", () => {
    expect(taskMatchesQuery(task({ id: "t1", title: "X" }), "   ")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(taskMatchesQuery(task({ id: "t1", title: "X", description: "Y" }), "zzz")).toBe(false);
  });
});
