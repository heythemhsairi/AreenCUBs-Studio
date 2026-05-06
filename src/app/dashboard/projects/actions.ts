"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;
type ProjectStatus = (typeof STATUSES)[number];

function pickProjectFields(formData: FormData) {
  const status = String(formData.get("status") ?? "active") as ProjectStatus;
  return {
    client_id: String(formData.get("client_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    description: stringOrNull(formData.get("description")),
    status: STATUSES.includes(status) ? status : ("active" as ProjectStatus),
    owner_id: stringOrNull(formData.get("owner_id")),
    start_date: stringOrNull(formData.get("start_date")),
    end_date: stringOrNull(formData.get("end_date")),
  };
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function createProjectAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const fields = pickProjectFields(formData);
  if (!fields.client_id)
    return { ok: false, error: "Le client est requis." };
  if (!fields.name) return { ok: false, error: "Le nom est requis." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert(fields)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/clients/${fields.client_id}`);
  redirect(`/dashboard/projects/${data.id}`);
}

export async function updateProjectAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const fields = pickProjectFields(formData);
  if (!fields.name) return { ok: false, error: "Le nom est requis." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: fields.name,
      description: fields.description,
      status: fields.status,
      owner_id: fields.owner_id,
      start_date: fields.start_date,
      end_date: fields.end_date,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${id}`);
  return { ok: true };
}

export async function deleteProjectAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/projects");
  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(clientId ? `/dashboard/clients/${clientId}` : "/dashboard/projects");
}
