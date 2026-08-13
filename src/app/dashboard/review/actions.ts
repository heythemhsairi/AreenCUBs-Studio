"use server";

import { revalidatePath } from "next/cache";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ReviewActionResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Small staff-side review mutations. Video uploads live in upload-actions.ts:
 * keeping File bodies out of this module makes it impossible for the UI to
 * accidentally proxy a large video through a Vercel Function again.
 */
export async function addAgencyReviewCommentAction(
  formData: FormData,
): Promise<ReviewActionResult> {
  const session = await requireWorkerOrAdmin();
  const versionId = String(formData.get("version_id") ?? "");
  const assetId = String(formData.get("asset_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const timecodeRaw = String(formData.get("timecode_seconds") ?? "").trim();

  if (!versionId) return { ok: false, error: "Version manquante." };
  if (body.length === 0) return { ok: false, error: "Commentaire vide." };
  if (body.length > 2000) return { ok: false, error: "Commentaire trop long." };

  let timecode: number | null = null;
  if (timecodeRaw.length > 0) {
    timecode = Number(timecodeRaw);
    if (!Number.isFinite(timecode) || timecode < 0) {
      return { ok: false, error: "Timecode invalide." };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("review_comments").insert({
    version_id: versionId,
    author_id: session.id,
    author_side: "agency",
    body,
    timecode_seconds: timecode,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/review/${assetId}`);
  return { ok: true };
}

export async function setCommentResolvedAction(
  formData: FormData,
): Promise<ReviewActionResult> {
  const session = await requireWorkerOrAdmin();
  const commentId = String(formData.get("comment_id") ?? "");
  const assetId = String(formData.get("asset_id") ?? "");
  const resolved = String(formData.get("resolved") ?? "") === "true";

  if (!commentId) return { ok: false, error: "Commentaire manquant." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_comments")
    .update(
      resolved
        ? { resolved_at: new Date().toISOString(), resolved_by: session.id }
        : { resolved_at: null, resolved_by: null },
    )
    .eq("id", commentId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Commentaire introuvable." };
  }

  revalidatePath(`/dashboard/review/${assetId}`);
  return { ok: true };
}

export async function setReviewStatusAction(
  formData: FormData,
): Promise<ReviewActionResult> {
  const session = await requireWorkerOrAdmin();
  const assetId = String(formData.get("asset_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!assetId) return { ok: false, error: "Élément manquant." };
  if (!["in_review", "changes_requested", "approved", "archived"].includes(status)) {
    return { ok: false, error: "Statut invalide." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_assets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Élément introuvable." };

  await supabase.from("audit_log").insert({
    actor_id: session.id,
    actor_role: session.role,
    action: "review.status_changed",
    entity_type: "review_asset",
    entity_id: assetId,
    summary: status,
  });

  revalidatePath(`/dashboard/review/${assetId}`);
  revalidatePath("/dashboard/review");
  return { ok: true };
}

/** A ten-minute private playback URL generated per request and never stored. */
export async function getReviewMediaUrlAction(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireWorkerOrAdmin();
  const versionId = String(formData.get("version_id") ?? "");
  if (!versionId) return { ok: false, error: "Version manquante." };

  const supabase = await createClient();
  const { data: version } = await supabase
    .from("review_versions")
    .select("storage_path")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return { ok: false, error: "Version introuvable." };

  const { data, error } = await supabase.storage
    .from("review-media")
    .createSignedUrl(version.storage_path, 60 * 10);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Fichier indisponible." };
  }
  return { ok: true, url: data.signedUrl };
}
