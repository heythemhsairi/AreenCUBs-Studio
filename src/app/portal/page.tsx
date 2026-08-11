import { requireClientContact } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalClient, type PortalItem } from "./portal-client";

/**
 * Client portal.
 *
 * Reads three owner-run views — `portal_client_org`, `portal_content_plans`
 * and `portal_content_items` — and never a base table. That is the whole
 * design: the `client` role holds no policy on any internal table, so the
 * Phase 2 assertion that it reads zero rows from all of them stays true, and
 * the portal's surface is exactly the columns those views project.
 *
 * Nothing here filters by client id. Membership is resolved inside the views
 * by `client_contact_of()`, which means a mistake in this file cannot widen
 * what is returned. If it could, the boundary would be in the wrong place.
 */
export default async function PortalPage() {
  const session = await requireClientContact();
  const supabase = await createClient();

  const [orgRes, itemsRes, reviewsRes] = await Promise.all([
    supabase.from("portal_client_org").select("id, name").maybeSingle(),
    supabase
      .from("portal_content_items")
      .select(
        "id, title, content_type, platform, caption, publish_date, status, approval_status, final_asset_url",
      )
      .order("publish_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("portal_review_assets")
      .select("id, title, status, updated_at")
      .order("updated_at", { ascending: false }),
  ]);

  const loadError =
    orgRes.error?.message ?? itemsRes.error?.message ?? reviewsRes.error?.message ?? null;

  const items: PortalItem[] = (itemsRes.data ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    contentType: i.content_type,
    platform: i.platform,
    caption: i.caption,
    publishDate: i.publish_date,
    status: i.status,
    approvalStatus: i.approval_status,
    assetUrl: i.final_asset_url,
  }));

  return (
    <PortalClient
      contactName={(session.full_name ?? session.username).split(" ")[0]}
      orgName={orgRes.data?.name ?? null}
      items={items}
      reviews={(reviewsRes.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
      }))}
      loadError={loadError}
    />
  );
}
