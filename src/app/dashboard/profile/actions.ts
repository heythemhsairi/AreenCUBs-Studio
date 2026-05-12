"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateMyProfileAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { ok: false, error: "Nom complet requis." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", session.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function uploadMyAvatarAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Fichier manquant." };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: "Image trop grande (max 4 Mo)." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Le fichier doit être une image." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${session.id}/${Date.now()}.${ext}`;

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(path);

  const { error: updErr } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", session.id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeMyAvatarAction(): Promise<ActionResult> {
  const session = await requireSession();
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", session.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function changeMyPasswordAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { ok: false, error: "Mot de passe minimum 8 caractères." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(session.id, {
    password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
