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
  | "youtube"
  | "threads"
  | "pinterest"
  | "snapchat"
  | "telegram";

export type SocialPostStatus = "draft" | "scheduled" | "published" | "cancelled";

function parsePlatforms(formData: FormData): SocialPlatform[] {
  return (formData.getAll("platforms") as string[]).filter(Boolean) as SocialPlatform[];
}

export async function createSocialPostAction(formData: FormData) {
  const session = await requireWorkerOrAdmin();
  const supabase = await createClient();

  const title = (formData.get("title") as string | null)?.trim();
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  const platforms = parsePlatforms(formData);
  const scheduled_at = (formData.get("scheduled_at") as string | null) || null;
  const media_url = (formData.get("media_url") as string | null)?.trim() || null;
  const hashtags = (formData.get("hashtags") as string | null)?.trim() ?? "";
  const first_comment = (formData.get("first_comment") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() ?? "";
  const project_id = (formData.get("project_id") as string | null) || null;
  const task_id = (formData.get("task_id") as string | null) || null;

  if (!title) return { ok: false, error: "Title is required" };
  if (platforms.length === 0) return { ok: false, error: "At least one platform is required" };

  const status: SocialPostStatus = scheduled_at ? "scheduled" : "draft";

  const { error } = await supabase.from("social_posts").insert({
    title,
    content,
    platforms,
    status,
    scheduled_at,
    media_url,
    hashtags,
    first_comment,
    notes,
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
  const platforms = parsePlatforms(formData);
  const scheduled_at = (formData.get("scheduled_at") as string | null) || null;
  const media_url = (formData.get("media_url") as string | null)?.trim() || null;
  const hashtags = (formData.get("hashtags") as string | null)?.trim() ?? "";
  const first_comment = (formData.get("first_comment") as string | null)?.trim() ?? "";
  const notes = (formData.get("notes") as string | null)?.trim() ?? "";
  const project_id = (formData.get("project_id") as string | null) || null;
  const task_id = (formData.get("task_id") as string | null) || null;

  if (!title) return { ok: false, error: "Title is required" };
  if (platforms.length === 0) return { ok: false, error: "At least one platform is required" };

  const status: SocialPostStatus = scheduled_at ? "scheduled" : "draft";

  const { error } = await supabase
    .from("social_posts")
    .update({ title, content, platforms, status, scheduled_at, media_url, hashtags, first_comment, notes, project_id, task_id })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/social-media");
  return { ok: true };
}

export async function duplicateSocialPostAction(id: string) {
  const session = await requireWorkerOrAdmin();
  const supabase = await createClient();

  const { data: original, error: fetchErr } = await supabase
    .from("social_posts")
    .select("title, content, platforms, hashtags, first_comment, notes, media_url, project_id, task_id")
    .eq("id", id)
    .single();

  if (fetchErr || !original) return { ok: false, error: "Post not found" };

  const { error } = await supabase.from("social_posts").insert({
    ...original,
    title: `${original.title} (copie)`,
    status: "draft",
    scheduled_at: null,
    published_at: null,
    created_by: session.id,
  });

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
