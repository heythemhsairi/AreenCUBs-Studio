"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyMany } from "@/lib/notify";
import { logActivity } from "@/lib/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_LEN = 4000;

/**
 * Pull @username tokens out of a comment body. Allows letters, digits,
 * hyphens, dots and underscores in usernames (matches our usernameToEmail
 * normalization).
 */
function parseMentions(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/(?:^|\s)@([a-zA-Z0-9._-]{2,32})\b/g)) {
    out.add(m[1].toLowerCase());
  }
  return Array.from(out);
}

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

  // Activity log
  await logActivity(taskId, session.id, "comment_added");

  // Fetch context once for both assignee + mention notifications
  const { data: task } = await supabase
    .from("tasks")
    .select("assignee_id, title")
    .eq("id", taskId)
    .single();

  // Resolve @mention usernames → user ids
  const mentions = parseMentions(body);
  let mentionUserIds: string[] = [];
  if (mentions.length > 0) {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username")
      .in("username", mentions);
    mentionUserIds = (profiles ?? [])
      .map((p) => p.id as string)
      .filter((id) => id !== session.id); // don't notify yourself
  }

  // Notify the assignee (unless they're the author or already mentioned)
  if (
    task?.assignee_id &&
    task.assignee_id !== session.id &&
    !mentionUserIds.includes(task.assignee_id)
  ) {
    await notify(
      task.assignee_id,
      "task_comment",
      `Nouveau commentaire sur « ${task.title} »`,
      `/dashboard/tasks/${taskId}`,
    );
  }

  // Notify everyone explicitly mentioned
  if (mentionUserIds.length > 0) {
    await notifyMany(
      mentionUserIds,
      "task_mention",
      `${session.full_name ?? "@" + session.username} vous a mentionné sur « ${task?.title ?? "une tâche"} »`,
      `/dashboard/tasks/${taskId}`,
    );
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true };
}

export async function deleteCommentAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (taskId) {
    await logActivity(taskId, session.id, "comment_deleted");
    revalidatePath(`/dashboard/tasks/${taskId}`);
  }
  return { ok: true };
}

/**
 * Returns members matching a partial @query. Used by the mention
 * autocomplete in the comment composer.
 */
export async function searchMentionsAction(
  query: string,
): Promise<
  Array<{ username: string; full_name: string | null; avatar_url: string | null }>
> {
  await requireSession();
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, full_name, avatar_url")
    .or(`username.ilike.${q}%,full_name.ilike.%${q}%`)
    .limit(5);
  return (data ?? []) as Array<{
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  }>;
}
