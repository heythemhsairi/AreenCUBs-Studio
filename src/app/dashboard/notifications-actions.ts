"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function markNotificationReadAction(
  id: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!id) return { ok: false, error: "ID manquant." };
  const supabase = await createClient();
  if (id.startsWith("reminder:")) {
    const reminderId = id.slice("reminder:".length);
    const { error } = await supabase
      .from("reminders")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", reminderId)
      .eq("owner_id", session.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/messages");
    return { ok: true };
  }
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", session.id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ error }, { error: reminderError }] = await Promise.all([
    supabase.from("notifications").update({ read_at: now }).eq("user_id", session.id).is("read_at", null),
    supabase.from("reminders").update({ completed_at: now }).eq("owner_id", session.id).is("completed_at", null).lte("remind_at", now),
  ]);
  if (error || reminderError) return { ok: false, error: error?.message ?? reminderError?.message ?? "Erreur." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteNotificationAction(
  id: string,
): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  if (id.startsWith("reminder:")) {
    const { error } = await supabase.from("reminders").delete().eq("id", id.slice("reminder:".length)).eq("owner_id", session.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/messages");
    return { ok: true };
  }
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", session.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
