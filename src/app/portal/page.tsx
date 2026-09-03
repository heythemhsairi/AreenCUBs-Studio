import { requireClientContact } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalClient, type PortalItem, type PortalPlan } from "./portal-client";

/**
 * Client portal.
 *
 * Reads owner-run client views — including `portal_client_org`,
 * `portal_content_items` and `portal_tasks` — and never a base table. That is the whole
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

  const [orgRes, plansRes, itemsRes, reviewsRes, tasksRes] = await Promise.all([
    supabase.from("portal_client_org").select("id, name").maybeSingle(),
    supabase
      .from("portal_content_plans")
      .select("id, month, year, theme, status")
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
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
    supabase
      .from("portal_tasks")
      .select("id, project_id, parent_task_id, project_name, title, description, status, deadline")
      .order("deadline", { ascending: true, nullsFirst: false }),
  ]);

  const loadError =
    orgRes.error?.message ?? plansRes.error?.message ?? itemsRes.error?.message ??
    reviewsRes.error?.message ?? tasksRes.error?.message ?? null;

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
      plans={(plansRes.data ?? []) as PortalPlan[]}
      items={items}
      reviews={(reviewsRes.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
      }))}
      tasks={(tasksRes.data ?? []).map((task) => ({
        id: task.id,
        projectId: task.project_id,
        parentTaskId: task.parent_task_id,
        projectName: task.project_name,
        title: task.title,
        description: task.description,
        status: task.status,
        deadline: task.deadline,
      }))}
      loadError={loadError}
    />
  );
}
