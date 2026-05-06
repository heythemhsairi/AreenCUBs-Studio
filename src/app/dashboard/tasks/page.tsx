import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { TasksKanban, type TaskCard } from "./tasks-kanban";

export default async function TasksPage() {
  const session = await requireSession();
  const supabase = await createClient();

  // RLS already filters: freelancers see only their own; workers/admins see all.
  const { data } = await supabase
    .from("tasks")
    .select(
      "id, title, status, priority, deadline, assignee_id, profiles:assignee_id(username, full_name), projects:project_id(id, name, clients:client_id(id, name))",
    )
    .order("created_at", { ascending: false });

  const tasks: TaskCard[] = (data ?? []).map((tk) => {
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
      project: project ? { id: project.id, name: project.name } : { id: "", name: "—" },
      client: client ? { id: client.id, name: client.name } : undefined,
    };
  });

  const isFreelancer = session.role === "freelancer";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isFreelancer ? "Mes tâches" : "Tâches"}
        action={
          !isFreelancer ? (
            <Link href="/dashboard/tasks/new">
              <Button>+ Nouvelle tâche</Button>
            </Link>
          ) : null
        }
      />
      <TasksKanban tasks={tasks} showProject />
    </div>
  );
}
