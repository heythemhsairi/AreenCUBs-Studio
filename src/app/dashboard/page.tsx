import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OverviewClient } from "./overview-client";

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [
    activeProjects,
    activeTasks,
    teamSize,
    clientsCount,
    outstandingDevis,
    featured,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["todo", "in_progress", "review"]),
    session.role === "admin"
      ? supabase.from("profiles").select("id", { count: "exact", head: true })
      : Promise.resolve({ count: null }),
    session.role !== "freelancer"
      ? supabase.from("clients").select("id", { count: "exact", head: true })
      : Promise.resolve({ count: null }),
    session.role === "admin"
      ? supabase
          .from("devis")
          .select("total_dt")
          .eq("payment_status", "unpaid")
      : Promise.resolve({ data: null as { total_dt: number }[] | null }),
    supabase
      .from("featured_employees")
      .select(
        "month, reason, user_id, profiles:user_id(username, full_name, role, avatar_url)",
      )
      .eq("month", monthKey)
      .maybeSingle(),
  ]);

  const outstandingDt =
    "data" in outstandingDevis && outstandingDevis.data
      ? outstandingDevis.data.reduce(
          (sum, row) => sum + Number(row.total_dt ?? 0),
          0,
        )
      : null;

  let featuredEmployee:
    | {
        username: string;
        full_name: string | null;
        avatar_url: string | null;
        reason: string | null;
        month: string;
      }
    | null = null;

  if (featured?.data) {
    const p = Array.isArray(featured.data.profiles)
      ? featured.data.profiles[0]
      : featured.data.profiles;
    if (p) {
      featuredEmployee = {
        username: p.username,
        full_name: p.full_name ?? null,
        avatar_url: p.avatar_url ?? null,
        reason: featured.data.reason ?? null,
        month: featured.data.month,
      };
    }
  }

  return (
    <OverviewClient
      role={session.role}
      fullName={session.full_name ?? session.username}
      counts={{
        activeProjects: activeProjects.count ?? 0,
        activeTasks: activeTasks.count ?? 0,
        teamSize: teamSize.count,
        clients: clientsCount.count,
        outstandingDt,
      }}
      featuredEmployee={featuredEmployee}
    />
  );
}
