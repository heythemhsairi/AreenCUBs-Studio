"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isWorkLocation, type WorkLocation } from "@/lib/work-schedule";

export type WorkLocationInput = WorkLocation | null;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Set a work location for a given date. Without `targetUserId` it writes for
 * the current session. With `targetUserId`, only admins can write for someone
 * else (RLS would block non-admins anyway; we surface a friendlier error here).
 * Passing `null` clears the row. Idempotent — upserts on (user_id, date).
 */
export async function setWorkLocationAction(
  date: string,
  location: WorkLocationInput,
  targetUserId?: string,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!ISO_DATE.test(date)) {
    return { ok: false, error: "Date invalide." };
  }
  if (location !== null && !isWorkLocation(location)) {
    return { ok: false, error: "Statut de planning invalide." };
  }

  const userId = targetUserId ?? session.id;
  if (userId !== session.id && session.role !== "admin") {
    return { ok: false, error: "Action réservée à l'administrateur." };
  }

  // Admin editing of another member is explicitly allowed by the table's RLS
  // policy, so keep this on the session client and let that policy enforce it.
  const supabase = await createClient();

  if (location === null) {
    const { error } = await supabase
      .from("work_schedule")
      .delete()
      .eq("user_id", userId)
      .eq("date", date);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("work_schedule")
      .upsert(
        { user_id: userId, date, location },
        { onConflict: "user_id,date" },
      );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team/planning");
  if (userId !== session.id) {
    revalidatePath(`/dashboard/team/planning/${userId}`);
  }
  return { ok: true };
}
