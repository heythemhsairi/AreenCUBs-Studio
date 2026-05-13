import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { type TaskCard } from "./tasks-kanban";
import { TasksView } from "./tasks-view";

export default async function TasksPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: tasksRaw }, { data: projectsRaw }, { data: assigneesRaw }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, status, priority, deadline, assignee_id, tags, profiles:assignee_id(username, full_name), projects:project_id(id, name, clients:client_id(id, name))",
        )
        .is("parent_task_id", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, name")
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, username, full_name")
        .order("full_name", { ascending: true }),
    ]);

  const tasks: TaskCard[] = (tasksRaw ?? []).map((tk) => {
    const assignee = Array.isArray(tk.profiles) ? tk.profiles[0] : tk.profiles;
    const project = Array.isArray(tk.projects) ? tk.projects[0] : tk.projects;
    const client = project
      ? Array.isArray(project.clients)
        ? project.clients[0]
        : project.clients
      : null;
    return {
      id: tk.id,
      title: tk.title,
      status: tk.status,
      priority: tk.priority,
      deadline: tk.deadline,
      assignee: assignee
        ? (assignee.full_name ?? `@${assignee.username}`)
        : null,
      assigneeId: tk.assignee_id,
      project: project
        ? { id: project.id, name: project.name }
        : { id: "", name: "—" },
      client: client ? { id: client.id, name: client.name } : undefined,
      tags: (tk.tags as string[] | null) ?? [],
    };
  });

  const projects = (projectsRaw ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));
  const assignees = (assigneesRaw ?? []).map((a) => ({
    value: a.id,
    label: a.full_name ?? `@${a.username}`,
  }));

  const isFreelancer = session.role === "freelancer";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isFreelancer ? "Mes tâches" : "Tâches"}
        description={
          isFreelancer
            ? "Toutes les tâches qui vous sont assignées."
            : "Vue d'ensemble de toutes les tâches du studio."
        }
        action={
          !isFreelancer ? (
            <Link href="/dashboard/tasks/new">
              <Button>+ Nouvelle tâche</Button>
            </Link>
          ) : null
        }
      />
      <TasksView
        tasks={tasks}
        projects={projects}
        assignees={assignees}
        currentUserId={session.id}
        currentUserAssigneeId={session.id}
      />
    </div>
  );
}
