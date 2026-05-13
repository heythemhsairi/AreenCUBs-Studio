"use server";

import { revalidatePath } from "next/cache";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

export type TaskTemplateRow = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  priority: Priority;
  default_deadline_offset_days: number | null;
  created_at: string;
};

export async function createTaskTemplateAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireWorkerOrAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const priorityRaw = String(formData.get("priority") ?? "normal");
  const priority: Priority = PRIORITIES.includes(priorityRaw as Priority)
    ? (priorityRaw as Priority)
    : "normal";
  const offsetRaw = formData.get("default_deadline_offset_days");
  const offset =
    offsetRaw === null || String(offsetRaw).trim() === ""
      ? null
      : Math.max(0, Number(offsetRaw) || 0);

  if (!name || !title) {
    return { ok: false, error: "Nom et titre requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("task_templates").insert({
    name,
    title,
    description,
    priority,
    default_deadline_offset_days: offset,
    created_by: session.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/tasks/templates");
  return { ok: true };
}

export async function deleteTaskTemplateAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };
  const supabase = await createClient();
  const { error } = await supabase.from("task_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/tasks/templates");
  return { ok: true };
}
