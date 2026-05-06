import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProjectDetailActions } from "./detail-actions";
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
      "id, title, status, priority, deadline, assignee_id, profiles:assignee_id(username, full_name)",
    )
    .eq("project_id", id)
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
      project: { id: project.id, name: project.name },
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
        <Card>
          <CardHeader>
            <CardTitle>Détails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Statut
              </p>
              <Badge
                tone={
                  project.status === "active"
                    ? "blue"
                    : project.status === "completed"
                      ? "green"
                      : project.status === "on_hold"
                        ? "amber"
                        : "slate"
                }
              >
                {project.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Responsable
              </p>
              <p className="text-slate-800">
                {owner
                  ? (owner.full_name ?? `@${owner.username}`)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Échéance
              </p>
              <p className="text-slate-800">
                {project.end_date
                  ? new Date(project.end_date).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            {project.description && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Description
                </p>
                <p className="whitespace-pre-wrap text-slate-800">
                  {project.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Tâches</h2>
            {session.role !== "freelancer" && (
              <Link href={`/dashboard/tasks/new?projectId=${project.id}`}>
                <Button size="sm">+ Nouvelle tâche</Button>
              </Link>
            )}
          </div>
          <TasksKanban tasks={taskCards} compact />
        </div>
      </div>
    </div>
  );
}
