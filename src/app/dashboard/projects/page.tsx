import Link from "next/link";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProjectsTable, type ProjectRow } from "./projects-table";

export default async function ProjectsPage() {
  await requireWorkerOrAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(
      "id, name, status, end_date, owner_id, profiles:owner_id(username, full_name), clients:client_id(id, name), tasks(count)",
    )
    .order("created_at", { ascending: false });

  const rows: ProjectRow[] = (data ?? []).map((p) => {
    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      end_date: p.end_date,
      owner: profile?.full_name ?? (profile ? `@${profile.username}` : "—"),
      tasks_count:
        Array.isArray(p.tasks) && p.tasks[0] ? p.tasks[0].count : 0,
      client: client ? { id: client.id, name: client.name } : undefined,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projets"
        action={
          <Link href="/dashboard/projects/new">
            <Button>+ Nouveau projet</Button>
          </Link>
        }
      />
      <ProjectsTable projects={rows} showClient />
    </div>
  );
}
