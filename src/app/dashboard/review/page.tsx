import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReviewListClient, type ReviewAssetRow } from "./review-list-client";

/**
 * Video review — staff workspace.
 *
 * Read access includes the commercial role: RLS already scopes them to their
 * own clients' reviews, so the page shows a commercial exactly their book and
 * staff everything. Mutations are guarded separately in actions.ts and the
 * creation form is hidden for commercial — hiding is presentation, the guard
 * is the rule.
 */
export default async function ReviewPage() {
  const session = await requireRoles(["admin", "worker", "commercial"]);
  const supabase = await createClient();

  const [assetsRes, versionsRes, directoryRes] = await Promise.all([
    supabase
      .from("review_assets")
      .select("id, client_id, title, status, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("review_versions").select("asset_id, version_number"),
    // client_directory rather than clients: readable by every role on this
    // page, and names are all the listing needs.
    supabase.from("client_directory").select("id, name"),
  ]);

  const nameById = new Map((directoryRes.data ?? []).map((c) => [c.id, c.name]));
  const versionCount = new Map<string, number>();
  for (const v of versionsRes.data ?? []) {
    versionCount.set(v.asset_id, Math.max(versionCount.get(v.asset_id) ?? 0, v.version_number));
  }

  const assets: ReviewAssetRow[] = (assetsRes.data ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    clientName: nameById.get(a.client_id) ?? "—",
    latestVersion: versionCount.get(a.id) ?? 0,
  }));

  // The creation form needs a client list; a commercial never sees the form.
  const clients =
    session.role === "commercial"
      ? []
      : (directoryRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));

  return (
    <ReviewListClient
      assets={assets}
      clients={clients}
      canCreate={session.role !== "commercial"}
      loadError={assetsRes.error?.message ?? null}
    />
  );
}
