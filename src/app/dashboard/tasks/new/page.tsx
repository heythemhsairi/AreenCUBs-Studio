import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TaskForm } from "../task-form";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  await requireWorkerOrAdmin();
  const { projectId } = await searchParams;
  const supabase = await createClient();

  const [{ data: projects }, { data: members }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, clients:client_id(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, username, full_name, role")
      .order("full_name"),
  ]);

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
    />
  );
}
