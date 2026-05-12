import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
