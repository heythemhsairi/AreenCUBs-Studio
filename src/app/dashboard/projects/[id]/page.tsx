import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProjectDetailActions } from "./detail-actions";
import { ProjectDetailsCard, TasksSectionHeader } from "./detail-card";
import { TasksKanban, type TaskCard } from "../../tasks/tasks-kanban";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, client_id, name, description, status, end_date, start_date, owner_id, profiles:owner_id(username, full_name), clients:client_id(id, name)",
    )
    .eq("id", id)
    .single();
  if (!project) notFound();

  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, title, status, priority, deadline, assignee_id, tags, profiles:assignee_id(username, full_name)",
    )
    .eq("project_id", id)
    .is("parent_task_id", null)
    .order("created_at", { ascending: true });

  const taskCards: TaskCard[] = (tasks ?? []).map((tk) => {
    const a = Array.isArray(tk.profiles) ? tk.profiles[0] : tk.profiles;
    return {
      id: tk.id,
      title: tk.title,
      status: tk.status,
      priority: tk.priority,
      deadline: tk.deadline,
      assignee: a ? a.full_name ?? `@${a.username}` : null,
      assigneeId: tk.assignee_id,
      project: { id: project.id, name: project.name },
      tags: (tk.tags as string[] | null) ?? [],
    };
  });

  const client = Array.isArray(project.clients)
    ? project.clients[0]
    : project.clients;
  const owner = Array.isArray(project.profiles)
    ? project.profiles[0]
    : project.profiles;

  return (
    <div className="space-y-8">
      <PageHeader
        title={project.name}
        subtitle={
          client ? (
            <>
              <Link
                href={`/dashboard/clients/${client.id}`}
                className="hover:underline"
              >
                ← {client.name}
              </Link>
            </>
          ) : null
        }
        action={
          session.role !== "freelancer" ? (
            <ProjectDetailActions
              projectId={project.id}
              clientId={project.client_id}
              isAdmin={session.role === "admin"}
            />
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ProjectDetailsCard
          project={{
            status: project.status,
            end_date: project.end_date,
            description: project.description,
          }}
          ownerName={
            owner
              ? (owner.full_name ?? `@${owner.username}`)
              : "—"
          }
        />

        <div className="space-y-3 lg:col-span-2">
          <TasksSectionHeader
            projectId={project.id}
            isFreelancer={session.role === "freelancer"}
          />
          <TasksKanban tasks={taskCards} compact />
        </div>
      </div>
    </div>
  );
}
