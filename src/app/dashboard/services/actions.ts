"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

function pickFields(formData: FormData) {
  const price = Number(formData.get("default_price_dt") ?? 0);
  return {
    name_fr: String(formData.get("name_fr") ?? "").trim(),
    name_en: stringOrNull(formData.get("name_en")),
    description_fr: stringOrNull(formData.get("description_fr")),
    description_en: stringOrNull(formData.get("description_en")),
    category: stringOrNull(formData.get("category")),
    default_price_dt: Number.isFinite(price) ? price : 0,
    default_unit: String(formData.get("default_unit") ?? "unit").trim() || "unit",
    active: formData.get("active") === "on",
  };
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function createServiceAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const fields = pickFields(formData);
  if (!fields.name_fr) return { ok: false, error: "Nom requis." };

  const supabase = await createClient();
  const { error } = await supabase.from("services").insert(fields);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}

export async function updateServiceAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const fields = pickFields(formData);
  if (!fields.name_fr) return { ok: false, error: "Nom requis." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update(fields)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/services");
  revalidatePath(`/dashboard/services/${id}`);
  return { ok: true };
}

export async function deleteServiceAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/services");
  redirect("/dashboard/services");
}

export async function toggleServiceActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/services");
  return { ok: true };
}
