import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { TaskForm } from "../task-form";
import { TaskDeleteButton } from "./delete-button";

export default async function TaskEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: task }, { data: assignees }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, project_id, title, description, status, priority, assignee_id, deadline, deliverable_url, projects:project_id(name, clients:client_id(name))",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("id, username, full_name, role")
      .order("full_name"),
  ]);

  if (!task) notFound();

  const project = Array.isArray(task.projects)
    ? task.projects[0]
    : task.projects;
  const client = project
    ? Array.isArray(project.clients)
      ? project.clients[0]
      : project.clients
    : null;

  return (
    <div className="space-y-6">
      {project && (
        <p className="text-xs text-slate-500">
          {client && <>{client.name} · </>}
          <Link
            href={`/dashboard/projects/${task.project_id}`}
            className="hover:underline"
          >
            {project.name}
          </Link>
        </p>
      )}

      <TaskForm
        mode="edit"
        task={task}
        assignees={assignees ?? []}
      />

      {session.role !== "freelancer" && (
        <TaskDeleteButton
          taskId={task.id}
          projectId={task.project_id}
        />
      )}
    </div>
  );
}
