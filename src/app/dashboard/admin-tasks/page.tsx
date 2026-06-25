import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminTasksClient } from "./admin-tasks-client";
import type { AdminTask } from "./types";

export const metadata = { title: "Admin Tasks" };

export default async function AdminTasksPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Fetch tasks with no FK joins — avoids PostgREST schema-cache issues
  const { data: rows, error } = await supabase
    .from("admin_tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[admin-tasks:list]", error);
  }

  const rawTasks = rows ?? [];

  // Collect unique IDs for related lookups
  const adminIds   = [...new Set(rawTasks.map((r) => r.assigned_admin_id).filter(Boolean))] as string[];
  const clientIds  = [...new Set(rawTasks.map((r) => r.related_client_id).filter(Boolean))] as string[];
  const projectIds = [...new Set(rawTasks.map((r) => r.related_project_id).filter(Boolean))] as string[];
  const devisIds   = [...new Set(rawTasks.map((r) => r.related_devis_id).filter(Boolean))] as string[];

  const [adminRes, clientRes, projectRes, devisRes] = await Promise.all([
    adminIds.length   ? supabase.from("profiles").select("id, full_name").in("id", adminIds)   : { data: [] },
    clientIds.length  ? supabase.from("clients").select("id, name").in("id", clientIds)          : { data: [] },
    projectIds.length ? supabase.from("projects").select("id, name").in("id", projectIds)        : { data: [] },
    devisIds.length   ? supabase.from("devis").select("id, number, kind").in("id", devisIds)     : { data: [] },
  ]);

  const adminMap   = Object.fromEntries((adminRes.data   ?? []).map((r: { id: string; full_name: string }) => [r.id, r.full_name]));
  const clientMap  = Object.fromEntries((clientRes.data  ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));
  const projectMap = Object.fromEntries((projectRes.data ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));
  const devisMap   = Object.fromEntries((devisRes.data   ?? []).map((r: { id: string; number: number; kind: string }) => [r.id, r]));

  const tasks: AdminTask[] = rawTasks.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    due_date: r.due_date,
    assigned_admin_id: r.assigned_admin_id,
    assigned_admin_name: r.assigned_admin_id ? (adminMap[r.assigned_admin_id] ?? null) : null,
    related_client_id: r.related_client_id,
    related_client_name: r.related_client_id ? (clientMap[r.related_client_id] ?? null) : null,
    related_project_id: r.related_project_id,
    related_project_name: r.related_project_id ? (projectMap[r.related_project_id] ?? null) : null,
    related_devis_id: r.related_devis_id,
    related_devis_number: r.related_devis_id ? (devisMap[r.related_devis_id]?.number ?? null) : null,
    related_devis_kind: r.related_devis_id ? (devisMap[r.related_devis_id]?.kind ?? null) : null,
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
