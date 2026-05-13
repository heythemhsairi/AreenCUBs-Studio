"use server";

import { revalidatePath } from "next/cache";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, "").slice(0, 32);
}

export async function createTagAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireWorkerOrAdmin();
  const name = normalize(String(formData.get("name") ?? ""));
  const color = String(formData.get("color") ?? "#3B8BBA");
  if (!name) return { ok: false, error: "Le nom du tag est requis." };
  if (!COLOR_RE.test(color)) return { ok: false, error: "Couleur invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("task_tag_catalog").insert({
    name,
    color,
    created_by: session.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/tasks/tags");
  revalidatePath("/dashboard/tasks");
  return { ok: true };
}

export async function updateTagAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const id = String(formData.get("id") ?? "");
  const color = String(formData.get("color") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };
  if (!COLOR_RE.test(color)) return { ok: false, error: "Couleur invalide." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_tag_catalog")
    .update({ color })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/tasks/tags");
  revalidatePath("/dashboard/tasks");
  return { ok: true };
}

export async function deleteTagAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_tag_catalog")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/tasks/tags");
  return { ok: true };
}
