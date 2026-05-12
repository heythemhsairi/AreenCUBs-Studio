"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function uploadTaskFileAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const taskId = String(formData.get("task_id") ?? "");
  const file = formData.get("file");
  if (!taskId) return { ok: false, error: "Tâche manquante." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Fichier manquant." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (max 25 Mo)." };
  }

  const admin = createAdminClient();
  const ext =
    file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
  const safeBase = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 60);
  const storagePath = `${taskId}/${Date.now()}-${safeBase}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from("task-files")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: dbErr } = await admin.from("task_files").insert({
    task_id: taskId,
    name: file.name,
    mime: file.type || null,
    size_bytes: file.size,
    storage_path: storagePath,
    uploaded_by: session.id,
  });
  if (dbErr) {
    await admin.storage.from("task-files").remove([storagePath]);
    return { ok: false, error: dbErr.message };
  }

  revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true };
}

export async function deleteTaskFileAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("task_files")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (!row) return { ok: false, error: "Fichier introuvable." };

  await admin.storage.from("task-files").remove([row.storage_path]);
  const { error } = await admin.from("task_files").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (taskId) revalidatePath(`/dashboard/tasks/${taskId}`);
  return { ok: true };
}

export async function getTaskFileDownloadUrlAction(
  fileId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireSession();
  if (!fileId) return { ok: false, error: "Fichier manquant." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("task_files")
    .select("storage_path, name")
    .eq("id", fileId)
    .single();
  if (!row) return { ok: false, error: "Fichier introuvable." };

  const { data, error } = await admin.storage
    .from("task-files")
    .createSignedUrl(row.storage_path, 60 * 10, {
      download: row.name,
    });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Échec du lien signé." };
  }
  return { ok: true, url: data.signedUrl };
}
