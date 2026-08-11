import { notFound } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReviewDetailClient, type ReviewComment, type ReviewVersion } from "./review-detail-client";

/**
 * One review asset: its versions, the conversation, and the staff controls.
 *
 * RLS decides visibility — staff see everything, a commercial only their own
 * clients' assets, and an id outside the caller's scope reads as absent, which
 * renders as 404. Absent and forbidden are deliberately the same page: a
 * distinct "forbidden" would confirm to a curious commercial that someone
 * else's asset id exists.
 */
export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRoles(["admin", "worker", "commercial"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("review_assets")
    .select("id, client_id, title, status, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!asset) notFound();

  const [versionsRes, directoryRes] = await Promise.all([
    supabase
      .from("review_versions")
      .select("id, version_number, mime, size_bytes, created_at")
      .eq("asset_id", id)
      .order("version_number", { ascending: false }),
    supabase.from("client_directory").select("id, name").eq("id", asset.client_id),
  ]);

  const versions: ReviewVersion[] = (versionsRes.data ?? []).map((v) => ({
    id: v.id,
    number: v.version_number,
    mime: v.mime,
    sizeBytes: v.size_bytes,
    createdAt: v.created_at,
  }));

  // Comments for every version, so the history stays readable after a new cut.
  let comments: ReviewComment[] = [];
  if (versions.length > 0) {
    const { data } = await supabase
      .from("review_comments")
      .select("id, version_id, author_side, body, timecode_seconds, resolved_at, created_at")
      .in("version_id", versions.map((v) => v.id))
      .order("created_at", { ascending: true });
    comments = (data ?? []).map((c) => ({
      id: c.id,
      versionId: c.version_id,
      side: c.author_side,
      body: c.body,
      timecode: c.timecode_seconds === null ? null : Number(c.timecode_seconds),
      resolved: c.resolved_at !== null,
    }));
  }

  return (
    <ReviewDetailClient
      asset={{
        id: asset.id,
        title: asset.title,
        status: asset.status,
        clientName: directoryRes.data?.[0]?.name ?? "—",
      }}
      versions={versions}
      comments={comments}
      canMutate={session.role !== "commercial"}
      // A commercial may read the review but holds no policy on the media
      // bucket, so playback is staff-only. Offering the control anyway sent
      // them through a staff-only action, which redirected them away.
      canPlayMedia={session.role !== "commercial"}
    />
  );
}
