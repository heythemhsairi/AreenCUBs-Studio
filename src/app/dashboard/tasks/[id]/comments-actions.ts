"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_LEN = 4000;

export async function addCommentAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const taskId = String(formData.get("task_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!taskId) return { ok: false, error: "Tâche manquante." };
  if (!body) return { ok: false, error: "Le commentaire est vide." };
  if (body.length > MAX_LEN) {
    return { ok: false, error: "Commentaire trop long (max 4000 caractères)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: session.id,
    body,
  });
  if (error) return { ok: false, error: error.message };

  // Notify the task assignee (unless it's the author themselves)
  const { data: task } = await supabase
    .from("tasks")
    .select("assignee_id, title")
    .eq("id", taskId)
    .single();
  if (task?.assignee_id && task.assignee_id !== session.id) {
    await notify(
      task.assignee_id,
      "task_comment",
      `Nouveau commentaire sur « ${task.title} »`,
      `/dashboard/tasks/${taskId}`,
    );
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true };
}

export async function deleteCommentAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  // RLS does the heavy lifting: author or admin only.
  const { error } = await supabase.from("task_comments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (taskId) revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true };
}
