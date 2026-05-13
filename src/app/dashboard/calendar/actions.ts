"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Update a task's deadline. Called when the user drags a task chip onto a
 * different calendar day. Passing null clears the deadline.
 */
export async function rescheduleTaskAction(
  taskId: string,
  newDeadlineIso: string | null,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!taskId) return { ok: false, error: "Tâche manquante." };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("tasks")
    .select("deadline, project_id")
    .eq("id", taskId)
    .single();

  const { error } = await supabase
    .from("tasks")
    .update({ deadline: newDeadlineIso })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  if (before && (before.deadline ?? null) !== newDeadlineIso) {
    await logActivity(taskId, session.id, "deadline_changed", {
      from: before.deadline,
      to: newDeadlineIso,
    });
  }

  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/tasks/${taskId}`);
  if (before?.project_id)
    revalidatePath(`/dashboard/projects/${before.project_id}`);
  return { ok: true };
}
