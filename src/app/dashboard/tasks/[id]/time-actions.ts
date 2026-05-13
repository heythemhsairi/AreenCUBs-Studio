"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function startTimerAction(
  taskId: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!taskId) return { ok: false, error: "Tâche manquante." };

  const supabase = await createClient();
  // Stop any currently-running timer for this user
  const now = new Date().toISOString();
  await supabase
    .from("time_entries")
    .update({
      ended_at: now,
      duration_seconds: 0, // best-effort; recomputed on read
    })
    .eq("user_id", session.id)
    .is("ended_at", null);

  const { error } = await supabase.from("time_entries").insert({
    user_id: session.id,
    task_id: taskId,
    started_at: now,
  });
  if (error) return { ok: false, error: error.message };

  await logActivity(taskId, session.id, "timer_started");
  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true };
}

export async function stopTimerAction(
  taskId: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!taskId) return { ok: false, error: "Tâche manquante." };

  const supabase = await createClient();
  const { data: running } = await supabase
    .from("time_entries")
    .select("id, started_at")
    .eq("user_id", session.id)
    .eq("task_id", taskId)
    .is("ended_at", null)
    .maybeSingle();

  if (!running) return { ok: false, error: "Aucun timer en cours." };

  const now = new Date();
  const startedAt = new Date(running.started_at);
  const duration = Math.max(
    0,
    Math.floor((now.getTime() - startedAt.getTime()) / 1000),
  );

  const { error } = await supabase
    .from("time_entries")
    .update({
      ended_at: now.toISOString(),
      duration_seconds: duration,
    })
    .eq("id", running.id);
  if (error) return { ok: false, error: error.message };

  await logActivity(taskId, session.id, "timer_stopped", {
    duration_seconds: duration,
  });
  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true };
}
