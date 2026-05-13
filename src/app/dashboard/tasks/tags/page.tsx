import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TagsClient, type TagRow } from "./tags-client";

export default async function TaskTagsPage() {
  await requireWorkerOrAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_tag_catalog")
    .select("id, name, color, created_at")
    .order("name", { ascending: true });

  const rows: TagRow[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    created_at: r.created_at,
  }));

  return <TagsClient initial={rows} />;
}
