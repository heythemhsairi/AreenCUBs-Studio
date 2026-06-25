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

  // Fetch task without FK joins
  const { data: raw, error } = await supabase
    .from("admin_tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) console.error("[admin-tasks:detail]", error);
  if (!raw) notFound();

  // Fetch related names individually
  const [adminRes, clientRes, projectRes, devisRes, adminsListRes, clientsListRes, projectsListRes, devisListRes] =
    await Promise.all([
      raw.assigned_admin_id
        ? supabase.from("profiles").select("full_name").eq("id", raw.assigned_admin_id).single()
        : Promise.resolve({ data: null }),
      raw.related_client_id
        ? supabase.from("clients").select("name").eq("id", raw.related_client_id).single()
        : Promise.resolve({ data: null }),
      raw.related_project_id
        ? supabase.from("projects").select("name").eq("id", raw.related_project_id).single()
        : Promise.resolve({ data: null }),
      raw.related_devis_id
        ? supabase.from("devis").select("number, kind").eq("id", raw.related_devis_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("profiles").select("id, full_name").eq("role", "admin").order("full_name"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("devis").select("id, number, kind").order("number", { ascending: false }).limit(100),
    ]);

  const task: AdminTask = {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    status: raw.status,
    priority: raw.priority,
    due_date: raw.due_date,
    assigned_admin_id: raw.assigned_admin_id,
    assigned_admin_name: (adminRes.data as { full_name: string } | null)?.full_name ?? null,
    related_client_id: raw.related_client_id,
    related_client_name: (clientRes.data as { name: string } | null)?.name ?? null,
    related_project_id: raw.related_project_id,
    related_project_name: (projectRes.data as { name: string } | null)?.name ?? null,
    related_devis_id: raw.related_devis_id,
    related_devis_number: (devisRes.data as { number: number } | null)?.number ?? null,
    related_devis_kind: (devisRes.data as { kind: string } | null)?.kind ?? null,
    created_by: raw.created_by,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AdminTaskDetailClient
        task={task}
        admins={adminsListRes.data ?? []}
        clients={clientsListRes.data ?? []}
        projects={projectsListRes.data ?? []}
        devisList={devisListRes.data ?? []}
      />
    </div>
  );
}
