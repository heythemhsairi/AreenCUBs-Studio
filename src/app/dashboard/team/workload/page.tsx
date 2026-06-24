import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { WorkloadView } from "./workload-view";

export const metadata = { title: "Charge équipe — Areen CUBs" };

export default async function WorkloadPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const monthStart = startOfMonth.toISOString().slice(0, 10);

  const [{ data: profiles }, { data: tasksRaw }, { data: timeRaw }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, username, full_name, avatar_url, role, job_title")
        .order("full_name"),
      admin
        .from("tasks")
        .select(
          "id, title, status, priority, deadline, assignee_id, project_id, projects:project_id(name)",
        )
        .is("parent_task_id", null)
        .neq("status", "cancelled"),
      admin
        .from("time_entries")
        .select("user_id, duration_seconds, started_at")
        .gte("started_at", monthStart),
    ]);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  type MemberStats = {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
    job_title: string | null;
    active: number;
    overdue: number;
    done_month: number;
    in_progress: number;
    review: number;
    total_tracked_seconds: number;
    projects: string[];
    overdue_tasks: { id: string; title: string; deadline: string; days_late: number; project: string }[];
  };

  const statsMap = new Map<string, MemberStats>();

  for (const p of profiles ?? []) {
    statsMap.set(p.id, {
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      role: p.role,
      job_title: p.job_title,
      active: 0,
      overdue: 0,
      done_month: 0,
      in_progress: 0,
      review: 0,
      total_tracked_seconds: 0,
      projects: [],
      overdue_tasks: [],
    });
  }

  for (const task of tasksRaw ?? []) {
    if (!task.assignee_id) continue;
    const m = statsMap.get(task.assignee_id);
    if (!m) continue;

    const project = Array.isArray(task.projects)
      ? task.projects[0]
      : task.projects;
    const projectName = project?.name ?? "—";
    if (!m.projects.includes(projectName)) m.projects.push(projectName);

    if (task.status === "done") {
      m.done_month++;
    } else {
      m.active++;
      if (task.status === "in_progress") m.in_progress++;
      if (task.status === "review") m.review++;

      if (task.deadline) {
        const d = new Date(task.deadline);
        d.setHours(0, 0, 0, 0);
        const daysLate = Math.floor(
          (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysLate > 0) {
          m.overdue++;
          m.overdue_tasks.push({
            id: task.id,
            title: task.title,
            deadline: task.deadline,
            days_late: daysLate,
            project: projectName,
          });
        }
      }
    }
  }

  for (const entry of timeRaw ?? []) {
    const m = statsMap.get(entry.user_id as string);
    if (!m) continue;
    m.total_tracked_seconds += Number(entry.duration_seconds ?? 0);
  }

  const members = Array.from(statsMap.values()).sort(
    (a, b) => b.active - a.active,
  );

  const summary = {
    mostLoaded: members.reduce((best, m) => (m.active > best.active ? m : best), members[0] ?? null),
    withOverdue: members.filter((m) => m.overdue > 0),
    unassigned: members.filter((m) => m.active === 0 && m.role !== "freelancer"),
    needsReview: members.filter((m) => m.review > 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Charge équipe"
        subtitle="Répartition des tâches actives, retards et surcharges"
      />
      <WorkloadView members={members} summary={summary} today={today} />
    </div>
  );
}
