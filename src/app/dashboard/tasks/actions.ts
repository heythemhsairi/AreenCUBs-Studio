"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STATUSES = [
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const RECURRENCES = ["daily", "weekly", "biweekly", "monthly"] as const;
type TaskStatus = (typeof STATUSES)[number];
type TaskPriority = (typeof PRIORITIES)[number];
type Recurrence = (typeof RECURRENCES)[number];

function pickTaskFields(formData: FormData) {
  const status = String(formData.get("status") ?? "todo") as TaskStatus;
  const priority = String(formData.get("priority") ?? "normal") as TaskPriority;
  const rawRecurrence = String(formData.get("recurrence") ?? "");
  const recurrence: Recurrence | null = (RECURRENCES as readonly string[]).includes(
    rawRecurrence,
  )
    ? (rawRecurrence as Recurrence)
    : null;
  const rawTags = String(formData.get("tags") ?? "");
  const tags = rawTags
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/^#/, ""))
    .filter((s) => s.length > 0 && s.length <= 32)
    .slice(0, 12);

  // Multi-assignee: the form posts one `assignee_ids` entry per selected
  // person. We dedupe and keep `assignee_id` = the first one as the
  // denormalized "primary" so existing Kanban / filters / notifications /
  // dashboard counts keep working unchanged.
  const assigneeIds = Array.from(
    new Set(
      formData
        .getAll("assignee_ids")
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0),
    ),
  );
  const legacySingle = stringOrNull(formData.get("assignee_id"));
  if (legacySingle && !assigneeIds.includes(legacySingle)) {
    assigneeIds.unshift(legacySingle);
  }

  return {
    project_id: String(formData.get("project_id") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    description: stringOrNull(formData.get("description")),
    status: STATUSES.includes(status) ? status : ("todo" as TaskStatus),
    priority: PRIORITIES.includes(priority)
      ? priority
      : ("normal" as TaskPriority),
    assignee_id: assigneeIds[0] ?? null,
    assignee_ids: assigneeIds,
    deadline: stringOrNull(formData.get("deadline")),
    deliverable_url: stringOrNull(formData.get("deliverable_url")),
    parent_task_id: stringOrNull(formData.get("parent_task_id")),
    tags,
    recurrence,
  };
}

/**
 * Replace the full assignee set for a task (works for subtasks too — a
 * subtask is just a task with parent_task_id). Keeps tasks.assignee_id in
 * sync as the denormalized primary. Safe to call with an empty array.
 */
async function syncTaskAssignees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  taskId: string,
  userIds: string[],
): Promise<void> {
  const uniq = Array.from(new Set(userIds.filter(Boolean)));
  await supabase.from("task_assignees").delete().eq("task_id", taskId);
  if (uniq.length > 0) {
    await supabase
      .from("task_assignees")
      .insert(uniq.map((user_id) => ({ task_id: taskId, user_id })));
  }
  await supabase
    .from("tasks")
    .update({ assignee_id: uniq[0] ?? null })
    .eq("id", taskId);
}

export async function setTaskAssigneesAction(
  taskId: string,
  userIds: string[],
): Promise<ActionResult> {
  const session = await requireSession();
  if (!taskId) return { ok: false, error: "Tâche manquante." };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("tasks")
    .select("title, project_id, parent_task_id")
    .eq("id", taskId)
    .single();

  const { data: prevRows } = await supabase
    .from("task_assignees")
    .select("user_id")
    .eq("task_id", taskId);
  const prevIds = new Set<string>(
    (prevRows ?? []).map((r: { user_id: string }) => r.user_id),
  );

  await syncTaskAssignees(supabase, taskId, userIds);

  // Notify newly added people (skip self).
  const added = userIds.filter((u) => !prevIds.has(u) && u !== session.id);
  if (added.length > 0 && before) {
    await notify(
      added[0],
      "task_assigned",
      `Tâche assignée : ${before.title}`,
      `/dashboard/tasks/${taskId}`,
    );
    for (let i = 1; i < added.length; i++) {
      await notify(
        added[i],
        "task_assigned",
        `Tâche assignée : ${before.title}`,
        `/dashboard/tasks/${taskId}`,
      );
    }
    await logActivity(taskId, session.id, "task_assigned", {
      count: userIds.length,
    });
  }

  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/tasks/${taskId}`);
  if (before?.parent_task_id)
    revalidatePath(`/dashboard/tasks/${before.parent_task_id}`);
  if (before?.project_id)
    revalidatePath(`/dashboard/projects/${before.project_id}`);
  return { ok: true };
}

function shiftDeadline(iso: string, recurrence: Recurrence): string {
  const d = new Date(iso);
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "biweekly") d.setDate(d.getDate() + 14);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function createTaskAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireWorkerOrAdmin();
  const fields = pickTaskFields(formData);
  if (!fields.project_id)
    return { ok: false, error: "Le projet est requis." };
  if (!fields.title) return { ok: false, error: "Le titre est requis." };

  const supabase = await createClient();
  const { assignee_ids, ...taskCols } = fields;
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...taskCols, created_by: session.id })
    .select("id, project_id")
    .single();
  if (error) return { ok: false, error: error.message };

  await syncTaskAssignees(supabase, data.id, assignee_ids);

  await logActivity(data.id, session.id, "task_created", {
    title: fields.title,
  });
  if (assignee_ids.length > 0) {
    await logActivity(data.id, session.id, "task_assigned", {
      count: assignee_ids.length,
    });
    // Notify each assignee — unless they assigned it to themselves.
    for (const uid of assignee_ids) {
      if (uid !== session.id) {
        await notify(
          uid,
          "task_assigned",
          `Nouvelle tâche : ${fields.title}`,
          `/dashboard/tasks/${data.id}`,
        );
      }
    }
  }

  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/projects/${data.project_id}`);
  redirect(`/dashboard/projects/${data.project_id}`);
}


export async function updateTaskAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const fields = pickTaskFields(formData);
  if (!fields.title) return { ok: false, error: "Le titre est requis." };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("tasks")
    .select(
      "status, priority, assignee_id, deadline, project_id, parent_task_id, title, description, deliverable_url, tags, recurrence, created_by",
    )
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: fields.title,
      description: fields.description,
      status: fields.status,
      priority: fields.priority,
      assignee_id: fields.assignee_id,
      deadline: fields.deadline,
      deliverable_url: fields.deliverable_url,
      tags: fields.tags,
      recurrence: fields.recurrence,
    })
    .eq("id", id)
    .select("project_id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Sync the full assignee set + notify newly added people.
  const { data: prevAssignees } = await supabase
    .from("task_assignees")
    .select("user_id")
    .eq("task_id", id);
  const prevIds = new Set<string>(
    (prevAssignees ?? []).map((r: { user_id: string }) => r.user_id),
  );
  await syncTaskAssignees(supabase, id, fields.assignee_ids);
  for (const uid of fields.assignee_ids) {
    if (!prevIds.has(uid) && uid !== session.id) {
      await notify(
        uid,
        "task_assigned",
        `Tâche assignée : ${fields.title}`,
        `/dashboard/tasks/${id}`,
      );
    }
  }

  if (before) {
    if (before.status !== fields.status) {
      await logActivity(id, session.id, "status_changed", {
        from: before.status,
        to: fields.status,
      });
      // Notify the creator when someone else moves the task to review or done.
      if (
        (fields.status === "review" || fields.status === "done") &&
        before.created_by &&
        before.created_by !== session.id
      ) {
        const label = fields.status === "review" ? "à valider" : "terminée";
        await notify(
          before.created_by,
          `task_${fields.status}`,
          `Tâche ${label} : ${fields.title}`,
          `/dashboard/tasks/${id}`,
        );
      }
    }
    if (before.priority !== fields.priority) {
      await logActivity(id, session.id, "priority_changed", {
        from: before.priority,
        to: fields.priority,
      });
    }
    if ((before.deadline ?? null) !== (fields.deadline ?? null)) {
      await logActivity(id, session.id, "deadline_changed", {
        from: before.deadline,
        to: fields.deadline,
      });
    }
    // Assignee-set changes: notifications already fired above via the
    // sync path; just record an activity entry.
    if ((before.assignee_id ?? null) !== (fields.assignee_id ?? null)) {
      if (fields.assignee_ids.length > 0) {
        await logActivity(id, session.id, "task_assigned", {
          count: fields.assignee_ids.length,
        });
      } else {
        await logActivity(id, session.id, "task_unassigned");
      }
    }
  }

  // Recurrence: edit-form path to done also spawns the next instance.
  if (
    before &&
    fields.status === "done" &&
    before.status !== "done" &&
    fields.recurrence &&
    !before.parent_task_id
  ) {
    const nextDeadline = fields.deadline
      ? shiftDeadline(fields.deadline, fields.recurrence)
      : null;
    const { data: nextRow } = await supabase
      .from("tasks")
      .insert({
        project_id: fields.project_id || before.project_id,
        title: fields.title,
        description: fields.description,
        status: "todo",
        priority: fields.priority,
        assignee_id: fields.assignee_id,
        deadline: nextDeadline,
        deliverable_url: fields.deliverable_url,
        tags: fields.tags,
        recurrence: fields.recurrence,
        created_by: session.id,
      })
      .select("id")
      .single();
    if (nextRow) {
      await logActivity(nextRow.id, session.id, "task_created", {
        title: fields.title,
        recurrence_of: id,
      });
    }
  }

  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/tasks/${id}`);
  if (data?.project_id)
    revalidatePath(`/dashboard/projects/${data.project_id}`);
  return { ok: true };
}

export async function changeTaskStatusAction(
  taskId: string,
  status: TaskStatus,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!STATUSES.includes(status)) {
    return { ok: false, error: "Statut invalide." };
  }
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("tasks")
    .select(
      "status, project_id, parent_task_id, title, description, priority, assignee_id, deadline, deliverable_url, tags, recurrence, created_by",
    )
    .eq("id", taskId)
    .single();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", taskId)
    .select("project_id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (before && before.status !== status) {
    await logActivity(taskId, session.id, "status_changed", {
      from: before.status,
      to: status,
    });
    // Mirror the edit-form notification path for Kanban drag / quick-change.
    type BeforeRow = typeof before & {
      created_by?: string | null;
      title?: string | null;
    };
    const bRow = before as BeforeRow;
    if (
      (status === "review" || status === "done") &&
      bRow.created_by &&
      bRow.created_by !== session.id
    ) {
      const label = status === "review" ? "à valider" : "terminée";
      await notify(
        bRow.created_by,
        `task_${status}`,
        `Tâche ${label} : ${bRow.title ?? "—"}`,
        `/dashboard/tasks/${taskId}`,
      );
    }
  }

  // Recurrence: when moving to done, spawn the next instance.
  if (
    before &&
    status === "done" &&
    before.status !== "done" &&
    before.recurrence &&
    !before.parent_task_id
  ) {
    const nextDeadline = before.deadline
      ? shiftDeadline(before.deadline, before.recurrence as Recurrence)
      : null;
    const { data: nextRow } = await supabase
      .from("tasks")
      .insert({
        project_id: before.project_id,
        title: before.title,
        description: before.description,
        status: "todo",
        priority: before.priority,
        assignee_id: before.assignee_id,
        deadline: nextDeadline,
        deliverable_url: before.deliverable_url,
        tags: before.tags ?? [],
        recurrence: before.recurrence,
        created_by: session.id,
      })
      .select("id")
      .single();
    if (nextRow) {
      await logActivity(nextRow.id, session.id, "task_created", {
        title: before.title,
        recurrence_of: taskId,
      });
    }
  }

  revalidatePath("/dashboard/tasks");
  if (data?.project_id)
    revalidatePath(`/dashboard/projects/${data.project_id}`);
  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true };
}

export async function deleteTaskAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/tasks");
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(projectId ? `/dashboard/projects/${projectId}` : "/dashboard/tasks");
}

// ===== Subtasks =====

export async function createSubtaskAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const parentId = String(formData.get("parent_task_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!parentId || !title) {
    return { ok: false, error: "Titre requis." };
  }

  const supabase = await createClient();
  // Lookup parent to inherit project_id + assignees
  const { data: parent } = await supabase
    .from("tasks")
    .select("project_id, assignee_id")
    .eq("id", parentId)
    .single();
  if (!parent) return { ok: false, error: "Tâche parente introuvable." };

  const { data: parentAssignees } = await supabase
    .from("task_assignees")
    .select("user_id")
    .eq("task_id", parentId);
  const inheritIds = (parentAssignees ?? []).map(
    (r: { user_id: string }) => r.user_id,
  );

  const { data: sub, error } = await supabase
    .from("tasks")
    .insert({
      project_id: parent.project_id,
      parent_task_id: parentId,
      title,
      status: "todo",
      priority: "normal",
      assignee_id: inheritIds[0] ?? parent.assignee_id ?? null,
      created_by: session.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (sub) await syncTaskAssignees(supabase, sub.id, inheritIds);

  await logActivity(parentId, session.id, "subtask_added", { title });
  revalidatePath(`/dashboard/tasks/${parentId}`);
  revalidatePath(`/dashboard/projects/${parent.project_id}`);
  return { ok: true };
}

export async function toggleSubtaskAction(
  subtaskId: string,
  done: boolean,
): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: done ? "done" : "todo" })
    .eq("id", subtaskId)
    .select("parent_task_id, project_id, title")
    .single();
  if (error) return { ok: false, error: error.message };

  if (done && data?.parent_task_id) {
    await logActivity(data.parent_task_id, session.id, "subtask_completed", {
      title: data.title,
    });
  }

  if (data?.parent_task_id)
    revalidatePath(`/dashboard/tasks/${data.parent_task_id}`);
  if (data?.project_id)
    revalidatePath(`/dashboard/projects/${data.project_id}`);
  return { ok: true };
}

export async function deleteSubtaskAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .select("parent_task_id, project_id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (data?.parent_task_id)
    revalidatePath(`/dashboard/tasks/${data.parent_task_id}`);
  if (data?.project_id)
    revalidatePath(`/dashboard/projects/${data.project_id}`);
  return { ok: true };
}
