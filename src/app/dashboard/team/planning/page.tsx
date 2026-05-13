import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamPlanningClient, type TeamMember } from "./planning-client";

export default async function TeamPlanningPage() {
  await requireAdmin();
  const admin = createAdminClient();

  // 3-month window centered on the current month
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    .toISOString()
    .slice(0, 10);

  const [{ data: profiles }, { data: schedule }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, full_name, avatar_url, role, job_title")
      .order("full_name"),
    admin
      .from("work_schedule")
      .select("user_id, date, location")
      .gte("date", start)
      .lte("date", end),
  ]);

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
  }));

  return <TeamPlanningClient members={members} />;
}
