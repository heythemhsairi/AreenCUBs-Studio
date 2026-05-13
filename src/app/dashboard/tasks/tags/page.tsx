import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tags"
        subtitle={
          <a href="/dashboard/tasks" className="hover:underline">
            ← Tâches
          </a>
        }
        description="Catalogue des étiquettes utilisées sur les tâches. Donnez à chaque tag une couleur pour le retrouver facilement dans le Kanban et le calendrier."
      />
      <TagsClient initial={rows} />
    </div>
  );
}
