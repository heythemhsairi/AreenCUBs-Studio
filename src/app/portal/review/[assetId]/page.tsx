import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClientContact } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalPlayerClient, type PortalReviewComment } from "./player-client";

/**
 * The client's review screen for one deliverable.
 *
 * Everything is read through the portal views, so membership and the
 * latest-version rule are enforced in the database, not here. An asset outside
 * the contact's organisation reads as absent and renders 404 — the same page
 * as a genuinely missing id, so ids cannot be probed.
 *
 * The media URL is SIGNED and SHORT-LIVED, created per request with the
 * client's own session: the storage SELECT policy scopes it to the
 * organisation's folder. Nothing durable is ever stored or rendered — a copied
 * link dies within minutes, and revoking membership revokes the file with it.
 */
export default async function PortalReviewPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  await requireClientContact();
  const { assetId } = await params;
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("portal_review_assets")
    .select("id, title, status")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) notFound();

  const { data: version } = await supabase
    .from("portal_review_versions")
    .select("id, version_number, storage_path, mime")
    .eq("asset_id", assetId)
    .maybeSingle();

  let mediaUrl: string | null = null;
  if (version) {
    const { data: signed } = await supabase.storage
      .from("review-media")
      .createSignedUrl(version.storage_path, 60 * 5);
    mediaUrl = signed?.signedUrl ?? null;
  }

  let comments: PortalReviewComment[] = [];
  if (version) {
    const { data } = await supabase
      .from("portal_review_comments")
      .select("id, author_side, body, timecode_seconds, resolved, created_at")
      .eq("version_id", version.id)
      .order("created_at", { ascending: true });
    comments = (data ?? []).map((c) => ({
      id: c.id,
      side: c.author_side,
      body: c.body,
      timecode: c.timecode_seconds === null ? null : Number(c.timecode_seconds),
      resolved: c.resolved,
    }));
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-sm text-content-2 transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Retour à votre espace
      </Link>

      <PortalPlayerClient
        assetId={asset.id}
        title={asset.title}
        status={asset.status}
        versionId={version?.id ?? null}
        versionNumber={version?.version_number ?? null}
        mediaUrl={mediaUrl}
        comments={comments}
      />
    </main>
  );
}
