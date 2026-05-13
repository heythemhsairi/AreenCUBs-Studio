"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STATUSES = [
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
type TaskStatus = (typeof STATUSES)[number];
type TaskPriority = (typeof PRIORITIES)[number];

function pickTaskFields(formData: FormData) {
  const status = String(formData.get("status") ?? "todo") as TaskStatus;
  const priority = String(formData.get("priority") ?? "normal") as TaskPriority;
  return {
    project_id: String(formData.get("project_id") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    description: stringOrNull(formData.get("description")),
    status: STATUSES.includes(status) ? status : ("todo" as TaskStatus),
    priority: PRIORITIES.includes(priority)
      ? priority
      : ("normal" as TaskPriority),
    assignee_id: stringOrNull(formData.get("assignee_id")),
    deadline: stringOrNull(formData.get("deadline")),
    deliverable_url: stringOrNull(formData.get("deliverable_url")),
    parent_task_id: stringOrNull(formData.get("parent_task_id")),
  };
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
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...fields, created_by: session.id })
    .select("id, project_id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity(data.id, session.id, "task_created", {
    title: fields.title,
  });
  if (fields.assignee_id) {
    const assigneeName = await resolveProfileName(fields.assignee_id);
    await logActivity(data.id, session.id, "task_assigned", {
      assignee_id: fields.assignee_id,
      assignee_name: assigneeName,
    });
  }

  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/projects/${data.project_id}`);
  redirect(`/dashboard/projects/${data.project_id}`);
}

async function resolveProfileName(userId: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", userId)
      .maybeSingle();
    return data?.full_name ?? (data?.username ? `@${data.username}` : "quelqu'un");
  } catch {
    return "quelqu'un";
  }
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
    .select("status, priority, assignee_id, deadline")
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
    })
    .eq("id", id)
    .select("project_id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (before) {
    if (before.status !== fields.status) {
      await logActivity(id, session.id, "status_changed", {
        from: before.status,
        to: fields.status,
      });
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
    if ((before.assignee_id ?? null) !== (fields.assignee_id ?? null)) {
      if (fields.assignee_id) {
        const assigneeName = await resolveProfileName(fields.assignee_id);
        await logActivity(id, session.id, "task_assigned", {
          assignee_id: fields.assignee_id,
          assignee_name: assigneeName,
        });
      } else {
        await logActivity(id, session.id, "task_unassigned");
      }
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
    .select("status")
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
  // Lookup parent to inherit project_id + assignee
  const { data: parent } = await supabase
    .from("tasks")
    .select("project_id, assignee_id")
    .eq("id", parentId)
    .single();
  if (!parent) return { ok: false, error: "Tâche parente introuvable." };

  const { error } = await supabase.from("tasks").insert({
    project_id: parent.project_id,
    parent_task_id: parentId,
    title,
    status: "todo",
    priority: "normal",
    assignee_id: parent.assignee_id,
    created_by: session.id,
  });
  if (error) return { ok: false, error: error.message };

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
