"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type WorkLocation = "office" | "home" | null;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Set the current user's work location for a given date. Passing `null`
 * clears it. Idempotent — upserts on (user_id, date).
 */
export async function setWorkLocationAction(
  date: string,
  location: WorkLocation,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!ISO_DATE.test(date)) {
    return { ok: false, error: "Date invalide." };
  }

  const supabase = await createClient();

  if (location === null) {
    const { error } = await supabase
      .from("work_schedule")
      .delete()
      .eq("user_id", session.id)
      .eq("date", date);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("work_schedule")
      .upsert(
        { user_id: session.id, date, location },
        { onConflict: "user_id,date" },
      );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
