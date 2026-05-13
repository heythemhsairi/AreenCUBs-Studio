import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { CalendarView, type CalendarTask, type CompletedEntry } from "./calendar-view";

export default async function CalendarPage() {
  const session = await requireSession();
  const supabase = await createClient();

  // Pull all tasks with a deadline (not just current month — client paginates
  // across months without hitting the DB for each navigation).
  const [{ data: tasksRaw }, { data: completedRaw }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, status, priority, deadline, assignee_id, tags, profiles:assignee_id(username, full_name), projects:project_id(id, name)",
      )
      .is("parent_task_id", null)
      .not("deadline", "is", null)
      .order("deadline", { ascending: true }),
    supabase
      .from("task_activity")
      .select(
        "id, created_at, action, meta, task_id, tasks:task_id(title, projects:project_id(name)), profiles:actor_id(username, full_name)",
      )
      .eq("action", "status_changed")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const tasks: CalendarTask[] = (tasksRaw ?? []).map((tk) => {
    const a = Array.isArray(tk.profiles) ? tk.profiles[0] : tk.profiles;
    const p = Array.isArray(tk.projects) ? tk.projects[0] : tk.projects;
    return {
      id: tk.id,
      title: tk.title,
      status: tk.status,
      priority: tk.priority,
      deadline: tk.deadline as string,
      assignee: a ? (a.full_name ?? `@${a.username}`) : null,
      project: p ? { id: p.id, name: p.name } : null,
      tags: (tk.tags as string[] | null) ?? [],
    };
  });

  const completed: CompletedEntry[] = (completedRaw ?? [])
    .filter((r) => {
      const m = r.meta as Record<string, unknown> | null;
      return m && m.to === "done";
    })
    .map((r) => {
      const tk = Array.isArray(r.tasks) ? r.tasks[0] : r.tasks;
      const proj = tk
        ? Array.isArray(tk.projects)
          ? tk.projects[0]
          : tk.projects
        : null;
      const actor = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        id: r.id,
        taskId: r.task_id,
        title: tk?.title ?? "Tâche supprimée",
        project: proj?.name ?? null,
        actor: actor ? (actor.full_name ?? `@${actor.username}`) : null,
        completedAt: r.created_at,
      };
    })
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendrier"
        description="Visualisez les échéances de l'équipe. Glissez une tâche sur une autre date pour la replanifier."
      />
      <CalendarView
        tasks={tasks}
        completed={completed}
        currentUserId={session.id}
      />
    </div>
  );
}
