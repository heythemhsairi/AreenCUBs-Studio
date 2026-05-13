import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TemplatesClient, type TaskTemplateRow } from "./templates-client";

export default async function TaskTemplatesPage() {
  await requireWorkerOrAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_templates")
    .select(
      "id, name, title, description, priority, default_deadline_offset_days, created_at",
    )
    .order("created_at", { ascending: false });

  const rows: TaskTemplateRow[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title,
    description: r.description,
    priority: r.priority,
    default_deadline_offset_days: r.default_deadline_offset_days,
    created_at: r.created_at,
  }));

  return <TemplatesClient initial={rows} />;
}
