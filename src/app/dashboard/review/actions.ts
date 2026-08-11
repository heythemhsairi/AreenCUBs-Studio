"use server";

import { revalidatePath } from "next/cache";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

/**
 * Staff-side video review actions.
 *
 * Everything here runs through the SESSION client, never the service role.
 * That is deliberate twice over: the storage policies (`is_staff()`) and the
 * table policies are then the real enforcement rather than a bypassed
 * formality, and the default e2e run — which carries no service-role key on
 * purpose — exercises the same code path production would.
 *
 * Mutations are staff-only (`requireWorkerOrAdmin`). A commercial can read
 * their own clients' reviews through RLS, but the workflow — uploading,
 * resolving, approving — belongs to the people doing the work.
 */

/** Upload cap. The server-action body limit in next.config is set to match. */
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
};

export async function createReviewAssetAction(
  formData: FormData,
): Promise<ReviewActionResult> {
  const session = await requireWorkerOrAdmin();
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!clientId) return { ok: false, error: "Client manquant." };
  if (title.length === 0) return { ok: false, error: "Titre obligatoire." };
  if (title.length > 200) return { ok: false, error: "Titre trop long." };

  const supabase = await createClient();

  // The insert itself is the authorization: review_assets_staff_all WITH CHECK
  // refuses anyone who is not staff, and the clients FK refuses an id that
  // does not exist. No pre-checks that could drift from the policy.
  const { error } = await supabase.from("review_assets").insert({
    client_id: clientId,
    title,
    created_by: session.id,
  });
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    actor_id: session.id,
    actor_role: session.role,
    action: "review.asset_created",
    entity_type: "review_asset",
    summary: title,
  });

  revalidatePath("/dashboard/review");
  return { ok: true };
}

export async function uploadReviewVersionAction(
  formData: FormData,
): Promise<ReviewActionResult> {
  const session = await requireWorkerOrAdmin();
  const assetId = String(formData.get("asset_id") ?? "");
  const file = formData.get("file");

  if (!assetId) return { ok: false, error: "Élément manquant." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Fichier manquant." };
  }

  // Server-side validation. The <input accept="video/*"> in the form is a
  // convenience, not a check — anything can be POSTed at a server action, so
  // the type and size decisions are made here or they are not made at all.
  if (!file.type.startsWith("video/")) {
    return { ok: false, error: "Le fichier doit être une vidéo." };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, error: "Vidéo trop grande (200 Mo maximum)." };
  }

  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("review_assets")
    .select("id, client_id")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return { ok: false, error: "Élément introuvable." };

  const { data: last } = await supabase
    .from("review_versions")
    .select("version_number")
    .eq("asset_id", assetId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = (last?.version_number ?? 0) + 1;

  // The path is the security boundary on the storage side: the first segment
  // is the owning client, and review_media_client_select reads it back to
  // decide what a portal contact may fetch. Built from database values only —
  // nothing user-controlled reaches the path, not even the filename.
  const ext = EXT_BY_MIME[file.type] ?? "mp4";
  const storagePath = `${asset.client_id}/${assetId}/v${next}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("review-media")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: insErr } = await supabase.from("review_versions").insert({
    asset_id: assetId,
    version_number: next,
    storage_path: storagePath,
    mime: file.type,
    size_bytes: file.size,
    uploaded_by: session.id,
  });
  if (insErr) {
    // The row is the source of truth; an orphaned object must not survive it.
    await supabase.storage.from("review-media").remove([storagePath]);
    return { ok: false, error: insErr.message };
  }

  // A new cut reopens the review: whatever the client said about the previous
  // version has been acted on, and the conversation starts from the new one.
  await supabase
    .from("review_assets")
    .update({ status: "in_review", updated_at: new Date().toISOString() })
    .eq("id", assetId);

  await supabase.from("audit_log").insert({
    actor_id: session.id,
    actor_role: session.role,
    action: "review.version_uploaded",
    entity_type: "review_asset",
    entity_id: assetId,
    summary: `v${next}`,
  });

  revalidatePath(`/dashboard/review/${assetId}`);
  revalidatePath("/dashboard/review");
  return { ok: true };
}

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

  // .select() so the result reports rows affected. RLS denies by filtering,
  // and a zero-row update reported as success would hide exactly the failure
  // this program keeps finding.
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

/**
 * A short-lived signed URL for a version's file, for the staff preview.
 *
 * Ten minutes, generated per request, never stored. The session client means
 * the storage SELECT policy decides — is_staff() here; the portal generates
 * its own URLs under the client's path-scoped policy.
 */
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
