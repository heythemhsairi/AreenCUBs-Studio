import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidRole } from "@/lib/auth";
import { taskAssignedMessage, taskDoneMessage } from "@/lib/role-copy";

/**
 * Fire an in-app notification for a single user. Safe to call anywhere —
 * silently swallows errors so notification delivery never breaks the
 * primary action that triggered it.
 */
export async function notify(
  userId: string | null | undefined,
  kind: string,
  body: string,
  link?: string | null,
): Promise<void> {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      user_id: userId,
      kind,
      body,
      link: link ?? null,
    });
  } catch (err) {
    console.error("[notify] failed", err);
  }
}

/** Fan-out helper — same notification for many users. Deduplicates. */
export async function notifyMany(
  userIds: Array<string | null | undefined>,
  kind: string,
  body: string,
  link?: string | null,
): Promise<void> {
  const uniq = Array.from(
    new Set(userIds.filter((u): u is string => Boolean(u))),
  );
  if (uniq.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert(
      uniq.map((user_id) => ({ user_id, kind, body, link: link ?? null })),
    );
  } catch (err) {
    console.error("[notifyMany] failed", err);
  }
}

/** Role-aware assignment copy keeps notifications warm without weakening the action's auth. */
export async function notifyTaskAssignment(
  userId: string | null | undefined,
  title: string,
  link: string,
): Promise<void> {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = isValidRole(profile?.role) ? profile.role : "worker";
    await admin.from("notifications").insert({
      user_id: userId,
      kind: "task_assigned",
      body: taskAssignedMessage(role, title),
      link,
    });
  } catch (err) {
    console.error("[notifyTaskAssignment] failed", err);
  }
}

export async function notifyTaskCompleted(
  userId: string | null | undefined,
  title: string,
  link: string,
): Promise<void> {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = isValidRole(profile?.role) ? profile.role : "worker";
    await admin.from("notifications").insert({
      user_id: userId,
      kind: "task_done",
      body: `${taskDoneMessage(role)} ${title}`,
      link,
    });
  } catch (err) {
    console.error("[notifyTaskCompleted] failed", err);
  }
}
