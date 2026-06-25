import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminTasksClient } from "./admin-tasks-client";
import type { AdminTask } from "./types";

export const metadata = { title: "Admin Tasks" };

export default async function AdminTasksPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("admin_tasks")
    .select(`
      *,
      assigned_admin:profiles!assigned_admin_id(full_name),
      related_client:clients!related_client_id(name),
      related_project:projects!related_project_id(name),
      related_devis:devis!related_devis_id(number, kind)
    `)
    .order("due_date", { ascending: true, nullsFirst: false });

  const tasks: AdminTask[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    due_date: r.due_date,
    assigned_admin_id: r.assigned_admin_id,
    assigned_admin_name: (r.assigned_admin as { full_name: string } | null)?.full_name ?? null,
    related_client_id: r.related_client_id,
    related_client_name: (r.related_client as { name: string } | null)?.name ?? null,
    related_project_id: r.related_project_id,
    related_project_name: (r.related_project as { name: string } | null)?.name ?? null,
    related_devis_id: r.related_devis_id,
    related_devis_number: (r.related_devis as { number: number } | null)?.number ?? null,
    related_devis_kind: (r.related_devis as { kind: string } | null)?.kind ?? null,
    created_by: r.created_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AdminTasksClient tasks={tasks} />
    </div>
  );
}
