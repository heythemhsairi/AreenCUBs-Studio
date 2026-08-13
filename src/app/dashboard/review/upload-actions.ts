"use server";

import { revalidatePath } from "next/cache";
import { requireWorkerOrAdmin } from "@/lib/auth";
import {
  reviewStoragePath,
  type ReviewUploadTicket,
  validateReviewVideo,
} from "@/lib/review-upload";
import { createClient } from "@/lib/supabase/server";

type UploadPrepareResult =
  | { ok: true; ticket: ReviewUploadTicket }
  | { ok: false; error: string };
type UploadFinalizeResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function readUploadMetadata(formData: FormData) {
  const mime = String(formData.get("mime") ?? "");
  const sizeBytes = Number(formData.get("size_bytes"));
  const error = validateReviewVideo(mime, sizeBytes);
  return error ? { ok: false as const, error } : { ok: true as const, mime, sizeBytes };
}

async function createTicket(
  asset: { id: string; client_id: string },
  versionNumber: number,
  mime: string,
): Promise<UploadPrepareResult> {
  const storagePath = reviewStoragePath(
    asset.client_id,
    asset.id,
    versionNumber,
    mime,
  );
  if (!storagePath) return { ok: false, error: "Format vidéo invalide." };

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("review-media")
    .createSignedUploadUrl(storagePath);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Téléversement indisponible." };
  }

  return {
    ok: true,
    ticket: {
      assetId: asset.id,
      storagePath,
      token: data.token,
      versionNumber,
    },
  };
}

/**
 * Creates only the small database record and a signed storage ticket. The
 * video bytes never pass through Vercel; the browser sends them directly to
 * the private Supabase bucket and calls finalise only after storage succeeds.
 */
export async function prepareReviewAssetUploadAction(
  formData: FormData,
): Promise<UploadPrepareResult> {
  const session = await requireWorkerOrAdmin();
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const metadata = readUploadMetadata(formData);

  if (!clientId) return { ok: false, error: "Client manquant." };
  if (!title) return { ok: false, error: "Titre obligatoire." };
  if (title.length > 200) return { ok: false, error: "Titre trop long." };
  if (!metadata.ok) return metadata;

  const supabase = await createClient();
  const { data: asset, error } = await supabase
    .from("review_assets")
    .insert({ client_id: clientId, title, created_by: session.id })
    .select("id, client_id")
    .single();
  if (error || !asset) {
    return { ok: false, error: error?.message ?? "Création impossible." };
  }

  const ticket = await createTicket(asset, 1, metadata.mime);
  if (!ticket.ok) {
    await supabase.from("review_assets").delete().eq("id", asset.id);
  }
  return ticket;
}

export async function prepareReviewVersionUploadAction(
  formData: FormData,
): Promise<UploadPrepareResult> {
  await requireWorkerOrAdmin();
  const assetId = String(formData.get("asset_id") ?? "");
  const metadata = readUploadMetadata(formData);
  if (!assetId) return { ok: false, error: "Élément manquant." };
  if (!metadata.ok) return metadata;

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

  return createTicket(asset, (last?.version_number ?? 0) + 1, metadata.mime);
}

export async function finalizeReviewUploadAction(
  formData: FormData,
): Promise<UploadFinalizeResult> {
  const session = await requireWorkerOrAdmin();
  const assetId = String(formData.get("asset_id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");
  const versionNumber = Number(formData.get("version_number"));
  const metadata = readUploadMetadata(formData);

  if (!assetId || !storagePath || !Number.isSafeInteger(versionNumber)) {
    return { ok: false, error: "Téléversement incomplet." };
  }
  if (!metadata.ok) return metadata;

  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("review_assets")
    .select("id, client_id, title")
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
  const expectedVersion = (last?.version_number ?? 0) + 1;
  const expectedPath = reviewStoragePath(
    asset.client_id,
    assetId,
    expectedVersion,
    metadata.mime,
  );

  if (versionNumber !== expectedVersion || storagePath !== expectedPath) {
    return {
      ok: false,
      error: "Une autre version a été ajoutée. Rechargez la page puis réessayez.",
    };
  }

  const { data: object, error: objectError } = await supabase.storage
    .from("review-media")
    .info(storagePath);
  if (objectError || !object) {
    return { ok: false, error: "La vidéo n'a pas atteint le stockage. Réessayez." };
  }
  if (
    (object.size !== undefined && object.size !== metadata.sizeBytes) ||
    (object.contentType && object.contentType !== metadata.mime)
  ) {
    await supabase.storage.from("review-media").remove([storagePath]);
    if (expectedVersion === 1) {
      await supabase.from("review_assets").delete().eq("id", assetId);
    }
    return { ok: false, error: "La vidéo reçue ne correspond pas au fichier choisi." };
  }

  const { error: versionError } = await supabase.from("review_versions").insert({
    asset_id: assetId,
    version_number: expectedVersion,
    storage_path: storagePath,
    mime: metadata.mime,
    size_bytes: metadata.sizeBytes,
    uploaded_by: session.id,
  });
  if (versionError) {
    await supabase.storage.from("review-media").remove([storagePath]);
    if (expectedVersion === 1) {
      await supabase.from("review_assets").delete().eq("id", assetId);
    }
    return { ok: false, error: versionError.message };
  }

  await supabase
    .from("review_assets")
    .update({ status: "in_review", updated_at: new Date().toISOString() })
    .eq("id", assetId);

  await supabase.from("audit_log").insert({
    actor_id: session.id,
    actor_role: session.role,
    action: expectedVersion === 1 ? "review.asset_created" : "review.version_uploaded",
    entity_type: "review_asset",
    entity_id: assetId,
    summary: expectedVersion === 1 ? asset.title : `v${expectedVersion}`,
  });

  revalidatePath(`/dashboard/review/${assetId}`);
  revalidatePath("/dashboard/review");
  return { ok: true, id: assetId };
}

export async function abandonReviewUploadAction(
  formData: FormData,
): Promise<{ ok: true }> {
  const session = await requireWorkerOrAdmin();
  const assetId = String(formData.get("asset_id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");
  const versionNumber = Number(formData.get("version_number"));
  if (!assetId) return { ok: true };

  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("review_assets")
    .select("id, client_id, created_by, review_versions(id, storage_path)")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return { ok: true };

  const expectedPrefix = `${asset.client_id}/${asset.id}/v${versionNumber}.`;
  const objectIsUnregistered = !asset.review_versions?.some(
    (version) => version.storage_path === storagePath,
  );
  if (
    Number.isSafeInteger(versionNumber) &&
    versionNumber > 0 &&
    storagePath.startsWith(expectedPrefix) &&
    objectIsUnregistered
  ) {
    await supabase.storage.from("review-media").remove([storagePath]);
  }

  if (
    versionNumber === 1 &&
    asset.created_by === session.id &&
    (asset.review_versions?.length ?? 0) === 0
  ) {
    await supabase.from("review_assets").delete().eq("id", assetId);
  }
  return { ok: true };
}
