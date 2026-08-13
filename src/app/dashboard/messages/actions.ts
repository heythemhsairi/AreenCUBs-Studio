"use server";

import { revalidatePath } from "next/cache";
import { requireInternal } from "@/lib/auth";
import { notifyMany } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import { findStudioSection } from "@/lib/studio-links";

export type CollaborationActionResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function sendStudioMessageAction(formData: FormData): Promise<CollaborationActionResult> {
  const session = await requireInternal();
  const body = text(formData, "body");
  if (!body) return { ok: false, error: "Écrivez un message avant de l'envoyer." };
  if (body.length > 4000) return { ok: false, error: "Le message est trop long (4 000 caractères maximum)." };

  const requestedRecipients = Array.from(new Set(
    formData.getAll("recipient_ids").map(String).filter((id) => UUID.test(id) && id !== session.id),
  ));
  if (requestedRecipients.length === 0) {
    return { ok: false, error: "Mentionnez au moins une personne." };
  }

  const supabase = await createClient();
  const { data: validPeople } = await supabase
    .from("studio_member_directory")
    .select("id")
    .in("id", requestedRecipients);
  const recipientIds = (validPeople ?? []).map((person) => person.id);
  if (recipientIds.length !== requestedRecipients.length) {
    return { ok: false, error: "Une personne sélectionnée n'est pas disponible." };
  }

  const taskIdRaw = text(formData, "task_id");
  const taskId = UUID.test(taskIdRaw) ? taskIdRaw : null;
  if (taskId) {
    const { data: task } = await supabase.from("tasks").select("id").eq("id", taskId).maybeSingle();
    if (!task) return { ok: false, error: "Cette tâche n'est pas accessible." };
  }

  const section = findStudioSection(text(formData, "section_path"));
  const { data: message, error } = await supabase
    .from("studio_messages")
    .insert({
      sender_id: session.id,
      body,
      task_id: taskId,
      section_path: section?.path ?? null,
      section_label: section?.labelFr ?? null,
    })
    .select("id")
    .single();
  if (error || !message) return { ok: false, error: error?.message ?? "Message non envoyé." };

  const { error: recipientError } = await supabase.from("studio_message_recipients").insert(
    recipientIds.map((user_id) => ({ message_id: message.id, user_id })),
  );
  if (recipientError) {
    await supabase.from("studio_messages").delete().eq("id", message.id);
    return { ok: false, error: recipientError.message };
  }

  const senderName = session.full_name ?? `@${session.username}`;
  const preview = body.length > 90 ? `${body.slice(0, 87)}…` : body;
  await notifyMany(recipientIds, "message_mention", `${senderName} vous a écrit : ${preview}`, `/dashboard/messages#message-${message.id}`);

  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markStudioMessagesReadAction(messageIds: string[]): Promise<CollaborationActionResult> {
  const session = await requireInternal();
  const ids = Array.from(new Set(messageIds.filter((id) => UUID.test(id)))).slice(0, 100);
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase
    .from("studio_message_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.id)
    .in("message_id", ids)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/messages");
  return { ok: true };
}

export async function deleteStudioMessageAction(id: string): Promise<CollaborationActionResult> {
  const session = await requireInternal();
  if (!UUID.test(id)) return { ok: false, error: "Message invalide." };
  const supabase = await createClient();
  const { error } = await supabase.from("studio_messages").delete().eq("id", id).eq("sender_id", session.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/messages");
  return { ok: true };
}

export async function createReminderAction(formData: FormData): Promise<CollaborationActionResult> {
  const session = await requireInternal();
  const title = text(formData, "title");
  if (!title || title.length > 240) return { ok: false, error: "Ajoutez un titre court au rappel." };

  const rawDate = text(formData, "remind_at");
  const remindAt = new Date(rawDate);
  if (!rawDate || Number.isNaN(remindAt.getTime())) return { ok: false, error: "Choisissez une date et une heure valides." };

  const supabase = await createClient();
  const taskIdRaw = text(formData, "task_id");
  const taskId = UUID.test(taskIdRaw) ? taskIdRaw : null;
  let link: string | null = null;
  if (taskId) {
    const { data: task } = await supabase.from("tasks").select("id").eq("id", taskId).maybeSingle();
    if (!task) return { ok: false, error: "Cette tâche n'est pas accessible." };
    link = `/dashboard/tasks/${taskId}`;
  } else {
    link = findStudioSection(text(formData, "section_path"))?.path ?? null;
  }

  const { error } = await supabase.from("reminders").insert({
    owner_id: session.id,
    title,
    remind_at: remindAt.toISOString(),
    link,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function completeReminderAction(id: string): Promise<CollaborationActionResult> {
  const session = await requireInternal();
  if (!UUID.test(id)) return { ok: false, error: "Rappel invalide." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("reminders")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", session.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteReminderAction(id: string): Promise<CollaborationActionResult> {
  const session = await requireInternal();
  if (!UUID.test(id)) return { ok: false, error: "Rappel invalide." };
  const supabase = await createClient();
  const { error } = await supabase.from("reminders").delete().eq("id", id).eq("owner_id", session.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard");
  return { ok: true };
}
