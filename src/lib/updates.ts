import { createClient } from "@/lib/supabase/server";

export type UpdateItem = {
  id: string;
  title: string;
  body: string;
  role: string | null;
  section: string | null;
  sort_order: number;
};

export type AppUpdate = {
  id: string;
  version: string;
  title: string;
  summary: string | null;
  released_at: string;
  items: UpdateItem[];
};

/**
 * Returns the latest active update the user has NOT yet seen globally,
 * plus its items. Returns null if the user has already seen it.
 */
export async function getUnseenUpdate(
  userId: string,
  userRole: string,
): Promise<AppUpdate | null> {
  const supabase = await createClient();

  // Fetch latest active update
  const { data: update } = await supabase
    .from("app_updates")
    .select("id, version, title, summary, released_at")
    .eq("active", true)
    .order("released_at", { ascending: false })
    .limit(1)
    .single();

  if (!update) return null;

  // Check if user already saw the global banner (section = null)
  const { data: seen } = await supabase
    .from("user_update_views")
    .select("id")
    .eq("user_id", userId)
    .eq("update_id", update.id)
    .is("section", null)
    .maybeSingle();

  if (seen) return null;

  // Fetch items relevant to this user's role (role = null means all roles)
  const { data: items } = await supabase
    .from("app_update_items")
    .select("id, title, body, role, section, sort_order")
    .eq("update_id", update.id)
    .or(`role.is.null,role.eq.${userRole}`)
    .order("sort_order", { ascending: true });

  return {
    id: update.id,
    version: update.version,
    title: update.title,
    summary: update.summary,
    released_at: update.released_at,
    items: items ?? [],
  };
}

