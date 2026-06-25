import type { Metadata } from "next";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ContentReportsClient } from "./content-reports-client";

export const metadata: Metadata = { title: "Rapports contenu — Areen CUBs" };

export default async function ContentReportsPage() {
  await requireWorkerOrAdmin();
  const supabase = await createClient();

  const [{ data: plans }, { data: socialPosts }] = await Promise.all([
    supabase
      .from("monthly_content_plans")
      .select(`
        id, client_id, month, year, theme, status, approved_at,
        clients(id, name),
        content_items(id, status, content_type, platform, approval_status, publish_date)
      `)
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
    supabase
      .from("social_posts")
      .select("id, status, platforms")
      .order("created_at", { ascending: false }),
  ]);

  const socialStats = {
    total: (socialPosts ?? []).length,
    scheduled: (socialPosts ?? []).filter((p) => p.status === "scheduled").length,
    published: (socialPosts ?? []).filter((p) => p.status === "published").length,
    draft: (socialPosts ?? []).filter((p) => p.status === "draft").length,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ContentReportsClient plans={(plans ?? []) as any} socialStats={socialStats} />;
}
