import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append an audit-log row for a task. Safe — errors are logged but never
 * break the calling action.
 */
export async function logActivity(
  taskId: string,
  actorId: string | null,
  action: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (!taskId) return;
  try {
    const admin = createAdminClient();
    await admin.from("task_activity").insert({
      task_id: taskId,
      actor_id: actorId,
      action,
      meta: meta ?? null,
    });
  } catch (err) {
    console.error("[activity] failed", err);
  }
}
