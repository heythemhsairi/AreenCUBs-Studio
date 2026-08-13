import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type TaskCard } from "../tasks/tasks-kanban";
import { TasksView } from "../tasks/tasks-view";

export default async function StudioTasksPage() {
  const session = await requireInternal();
  const supabase = await createClient();

  const [{ data: tasksRaw }, { data: assigneesRaw }, { data: tagCatalog }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, status, priority, deadline, assignee_id, tags, estimated_minutes, completed_at, profiles:assignee_id(username, full_name)")
        .eq("work_scope", "studio")
        .is("parent_task_id", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("studio_member_directory")
        .select("id, username, full_name")
        .order("full_name", { ascending: true }),
      supabase.from("task_tag_catalog").select("name, color"),
    ]);

  const tagColors: Record<string, string> = {};
  for (const tag of tagCatalog ?? []) tagColors[tag.name] = tag.color;

  const tasks: TaskCard[] = (tasksRaw ?? []).map((task) => {
    const assignee = Array.isArray(task.profiles) ? task.profiles[0] : task.profiles;
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      assignee: assignee ? assignee.full_name ?? `@${assignee.username}` : null,
      assigneeId: task.assignee_id,
      project: { id: "", name: "Areen CUBs" },
      tags: (task.tags as string[] | null) ?? [],
      estimated_minutes: task.estimated_minutes ?? null,
      completed_at: task.completed_at ?? null,
    };
  });

  return (
    <TasksView
      tasks={tasks}
      projects={[]}
      assignees={(assigneesRaw ?? []).map((person) => ({
        value: person.id,
        label: person.full_name ?? `@${person.username}`,
      }))}
      currentUserId={session.id}
      currentUserAssigneeId={session.id}
      tagColors={tagColors}
      isFreelancer={session.role === "freelancer"}
      isWorker={session.role === "worker"}
      currentRole={session.role}
      canCreate={session.role === "admin" || session.role === "worker"}
      defaultQuickFilter={session.role === "admin" ? "active" : "my_tasks"}
      scope="studio"
    />
  );
}
