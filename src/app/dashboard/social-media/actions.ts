"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkerOrAdmin } from "@/lib/auth";

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "twitter"
  | "tiktok"
  | "youtube";

export type SocialPostStatus = "draft" | "scheduled" | "published" | "cancelled";

export async function createSocialPostAction(formData: FormData) {
  const session = await requireWorkerOrAdmin();
  const supabase = await createClient();

  const title = (formData.get("title") as string | null)?.trim();
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  const platform = formData.get("platform") as SocialPlatform | null;
  const scheduled_at = (formData.get("scheduled_at") as string | null) || null;
  const media_url = (formData.get("media_url") as string | null)?.trim() || null;
  const project_id = (formData.get("project_id") as string | null) || null;
  const task_id = (formData.get("task_id") as string | null) || null;

  if (!title) return { ok: false, error: "Title is required" };
  if (!platform) return { ok: false, error: "Platform is required" };

  const status: SocialPostStatus = scheduled_at ? "scheduled" : "draft";

  const { error } = await supabase.from("social_posts").insert({
    title,
    content,
    platform,
    status,
    scheduled_at,
    media_url,
    project_id,
    task_id,
    created_by: session.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/social-media");
  return { ok: true };
}

export async function updateSocialPostAction(formData: FormData) {
  await requireWorkerOrAdmin();
  const supabase = await createClient();

  const id = formData.get("id") as string | null;
  if (!id) return { ok: false, error: "Missing post ID" };

  const title = (formData.get("title") as string | null)?.trim();
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  const platform = formData.get("platform") as SocialPlatform | null;
  const scheduled_at = (formData.get("scheduled_at") as string | null) || null;
  const media_url = (formData.get("media_url") as string | null)?.trim() || null;
  const project_id = (formData.get("project_id") as string | null) || null;
  const task_id = (formData.get("task_id") as string | null) || null;

  if (!title) return { ok: false, error: "Title is required" };
  if (!platform) return { ok: false, error: "Platform is required" };

  const status: SocialPostStatus = scheduled_at ? "scheduled" : "draft";

  const { error } = await supabase
    .from("social_posts")
    .update({ title, content, platform, status, scheduled_at, media_url, project_id, task_id })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/social-media");
  return { ok: true };
}

export async function changeSocialPostStatusAction(
  id: string,
  status: SocialPostStatus,
) {
  await requireWorkerOrAdmin();
  const supabase = await createClient();

  const update: Record<string, unknown> = { status };
  if (status === "published") update.published_at = new Date().toISOString();

  const { error } = await supabase
    .from("social_posts")
    .update(update)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/social-media");
  return { ok: true };
}

export async function deleteSocialPostAction(formData: FormData) {
  await requireWorkerOrAdmin();
  const supabase = await createClient();

  const id = formData.get("id") as string | null;
  if (!id) return { ok: false, error: "Missing post ID" };

  const { error } = await supabase.from("social_posts").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/social-media");
  return { ok: true };
}
