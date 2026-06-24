import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamPlanningClient, type TeamMember } from "./planning-client";

export default async function TeamPlanningPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    .toISOString()
    .slice(0, 10);

  const [{ data: profiles }, { data: schedule }, { data: tasksRaw }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, username, full_name, avatar_url, role, job_title")
        .order("full_name"),
      admin
        .from("work_schedule")
        .select("user_id, date, location")
        .gte("date", start)
        .lte("date", end),
      admin
        .from("tasks")
        .select("id, assignee_id, status, deadline, priority")
        .is("parent_task_id", null)
        .neq("status", "cancelled")
        .neq("status", "done"),
    ]);

  const now2 = new Date();
  now2.setHours(0, 0, 0, 0);

  // Per-member workload context for today
  type WorkloadInfo = {
    active: number;
    overdue: number;
    due_today: number;
  };
  const workloadMap = new Map<string, WorkloadInfo>();
  for (const p of profiles ?? []) {
    workloadMap.set(p.id, { active: 0, overdue: 0, due_today: 0 });
  }
  for (const t of tasksRaw ?? []) {
    if (!t.assignee_id) continue;
    const w = workloadMap.get(t.assignee_id as string);
    if (!w) continue;
    w.active++;
    if (t.deadline) {
      const d = new Date(t.deadline as string);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() < now2.getTime()) w.overdue++;
      else if (d.getTime() === now2.getTime()) w.due_today++;
    }
  }

  const scheduleByUser: Record<string, Record<string, "office" | "home">> = {};
  for (const row of schedule ?? []) {
    const u = row.user_id as string;
    const d = row.date as string;
    if (!scheduleByUser[u]) scheduleByUser[u] = {};
    scheduleByUser[u][d] = row.location as "office" | "home";
  }

  const members: TeamMember[] = (profiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    job_title: p.job_title,
    schedule: scheduleByUser[p.id] ?? {},
    workload: workloadMap.get(p.id) ?? { active: 0, overdue: 0, due_today: 0 },
  }));

  return <TeamPlanningClient members={members} today={today} />;
}
