import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type TaskCard } from "./tasks-kanban";
import { TasksView } from "./tasks-view";

export default async function TasksPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [
    { data: tasksRaw },
    { data: projectsRaw },
    { data: assigneesRaw },
    { data: tagCatalog },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, status, priority, deadline, assignee_id, tags, estimated_minutes, completed_at, profiles:assignee_id(username, full_name), projects:project_id(id, name, clients:client_id(id, name))",
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
    supabase
      .from("task_tag_catalog")
      .select("name, color"),
  ]);

  const tagColors: Record<string, string> = {};
  for (const t of tagCatalog ?? []) tagColors[t.name] = t.color;

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
      estimated_minutes: tk.estimated_minutes ?? null,
      completed_at: tk.completed_at ?? null,
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

  return (
    <TasksView
      tasks={tasks}
      projects={projects}
      assignees={assignees}
      currentUserId={session.id}
      currentUserAssigneeId={session.id}
      tagColors={tagColors}
      isFreelancer={session.role === "freelancer"}
      defaultQuickFilter={session.role === "worker" ? "my_tasks" : "active"}
    />
  );
}
