"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

function pickClientFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    address: stringOrNull(formData.get("address")),
    matricule_fiscal: stringOrNull(formData.get("matricule_fiscal")),
    email: stringOrNull(formData.get("email")),
    phone: stringOrNull(formData.get("phone")),
    notes: stringOrNull(formData.get("notes")),
  };
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function createClientAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireWorkerOrAdmin();
  const fields = pickClientFields(formData);
  if (!fields.name) return { ok: false, error: "Le nom est requis." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...fields, created_by: session.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${data.id}`);
}

export async function updateClientAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const fields = pickClientFields(formData);
  if (!fields.name) return { ok: false, error: "Le nom est requis." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  return { ok: true };
}

export async function deleteClientAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}
