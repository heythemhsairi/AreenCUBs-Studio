"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STATUSES = ["todo", "in_progress", "waiting", "done", "cancelled"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
type AdminTaskStatus = (typeof STATUSES)[number];
type AdminTaskPriority = (typeof PRIORITIES)[number];

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

function pickFields(formData: FormData) {
  const status = str(formData.get("status")) as AdminTaskStatus;
  const priority = str(formData.get("priority")) as AdminTaskPriority;
  return {
    title:               str(formData.get("title")),
    description:         strOrNull(formData.get("description")),
    status:              STATUSES.includes(status) ? status : ("todo" as AdminTaskStatus),
    priority:            PRIORITIES.includes(priority) ? priority : ("normal" as AdminTaskPriority),
    due_date:            strOrNull(formData.get("due_date")),
    assigned_admin_id:   strOrNull(formData.get("assigned_admin_id")),
    related_client_id:   strOrNull(formData.get("related_client_id")),
    related_project_id:  strOrNull(formData.get("related_project_id")),
    related_devis_id:    strOrNull(formData.get("related_devis_id")),
  };
}

export async function createAdminTaskAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const fields = pickFields(formData);
  if (!fields.title) return { ok: false, error: "Title is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_tasks")
    .insert({ ...fields, created_by: session.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/admin-tasks");
  redirect(`/dashboard/admin-tasks/${data.id}`);
}

export async function updateAdminTaskAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Missing ID." };

  const fields = pickFields(formData);
  if (!fields.title) return { ok: false, error: "Title is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_tasks")
    .update(fields)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/admin-tasks");
  revalidatePath(`/dashboard/admin-tasks/${id}`);
  return { ok: true };
}

export async function changeAdminTaskStatusAction(
  id: string,
  status: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!(STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "Invalid status." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_tasks")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/admin-tasks");
  revalidatePath(`/dashboard/admin-tasks/${id}`);
  return { ok: true };
}

export async function deleteAdminTaskAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("admin_tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/admin-tasks");
  redirect("/dashboard/admin-tasks");
}
