import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminTaskDetailClient } from "./admin-task-detail-client";
import type { AdminTask } from "../types";

export const metadata = { title: "Admin Task" };

export default async function AdminTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: raw }, { data: admins }, { data: clients }, { data: projects }, { data: devisList }] =
    await Promise.all([
      supabase
        .from("admin_tasks")
        .select(`
          *,
          assigned_admin:profiles!assigned_admin_id(full_name),
          related_client:clients!related_client_id(name),
          related_project:projects!related_project_id(name),
          related_devis:devis!related_devis_id(number, kind)
        `)
        .eq("id", id)
        .single(),
      supabase.from("profiles").select("id, full_name").eq("role", "admin").order("full_name"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("devis").select("id, number, kind").order("number", { ascending: false }).limit(100),
    ]);

  if (!raw) notFound();

  const task: AdminTask = {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    status: raw.status,
    priority: raw.priority,
    due_date: raw.due_date,
    assigned_admin_id: raw.assigned_admin_id,
    assigned_admin_name: (raw.assigned_admin as { full_name: string } | null)?.full_name ?? null,
    related_client_id: raw.related_client_id,
    related_client_name: (raw.related_client as { name: string } | null)?.name ?? null,
    related_project_id: raw.related_project_id,
    related_project_name: (raw.related_project as { name: string } | null)?.name ?? null,
    related_devis_id: raw.related_devis_id,
    related_devis_number: (raw.related_devis as { number: number } | null)?.number ?? null,
    related_devis_kind: (raw.related_devis as { kind: string } | null)?.kind ?? null,
    created_by: raw.created_by,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AdminTaskDetailClient
        task={task}
        admins={admins ?? []}
        clients={clients ?? []}
        projects={projects ?? []}
        devisList={devisList ?? []}
      />
    </div>
  );
}
