"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_PINS = 3;

/** Toggle a task on/off the current user's "today's priorities" list. */
export async function togglePriorityPinAction(
  taskId: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!taskId) return { ok: false, error: "Tâche manquante." };

  const supabase = await createClient();
  // Already pinned?
  const { data: existing } = await supabase
    .from("priority_pins")
    .select("id")
    .eq("user_id", session.id)
    .eq("task_id", taskId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("priority_pins")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    // Enforce max 3
    const { count } = await supabase
      .from("priority_pins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.id);
    if ((count ?? 0) >= MAX_PINS) {
      return {
        ok: false,
        error: `Vous avez déjà ${MAX_PINS} priorités épinglées. Désépinglez-en une d'abord.`,
      };
    }
    const { error } = await supabase
      .from("priority_pins")
      .insert({ user_id: session.id, task_id: taskId });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true };
}

/** Clear all of a user's priority pins (e.g. start of new day). */
export async function clearPriorityPinsAction(): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("priority_pins")
    .delete()
    .eq("user_id", session.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
