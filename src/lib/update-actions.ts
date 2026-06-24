"use server";

import { createClient } from "@/lib/supabase/server";

export async function markUpdateSeenAction(
  updateId: string,
  section: string | null,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("user_update_views").upsert(
    {
      user_id: user.id,
      update_id: updateId,
      section: section,
      seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,update_id,section", ignoreDuplicates: true },
  );
}
