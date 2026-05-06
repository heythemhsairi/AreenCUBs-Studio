import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OverviewClient } from "./overview-client";

export default async function DashboardPage() {
  const session = await requireSession();

  // Cheap counters for the overview KPIs.
  // Worker/freelancer see only what their RLS policies allow them to count.
  const supabase = await createClient();

  const [activeProjects, activeTasks, teamSize, clientsCount, outstandingDevis] =
    await Promise.all([
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
    ]);

  const outstandingDt =
    "data" in outstandingDevis && outstandingDevis.data
      ? outstandingDevis.data.reduce(
          (sum, row) => sum + Number(row.total_dt ?? 0),
          0,
        )
      : null;

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
    />
  );
}
