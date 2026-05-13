import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TaskForm, type TaskTemplateOption } from "../task-form";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; templateId?: string }>;
}) {
  await requireWorkerOrAdmin();
  const { projectId, templateId } = await searchParams;
  const supabase = await createClient();

  const [
    { data: projects },
    { data: members },
    { data: templates },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, clients:client_id(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, username, full_name, role")
      .order("full_name"),
    supabase
      .from("task_templates")
      .select(
        "id, name, title, description, priority, default_deadline_offset_days",
      )
      .order("name"),
  ]);

  const tplList: TaskTemplateOption[] = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    title: t.title,
    description: t.description,
    priority: t.priority,
    default_deadline_offset_days: t.default_deadline_offset_days,
  }));

  const chosen = templateId
    ? tplList.find((t) => t.id === templateId) ?? null
    : null;

  return (
    <TaskForm
      mode="create"
      defaultProjectId={projectId}
      projects={(projects ?? []).map((p) => {
        const c = Array.isArray(p.clients) ? p.clients[0] : p.clients;
        return {
          id: p.id,
          name: p.name,
          client_name: c?.name ?? null,
        };
      })}
      assignees={members ?? []}
      templates={tplList}
      preselectedTemplate={chosen}
    />
  );
}
