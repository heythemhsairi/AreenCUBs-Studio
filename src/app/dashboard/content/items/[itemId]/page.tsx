import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ContentItemDetailClient } from "./content-item-detail-client";

export const metadata: Metadata = { title: "Contenu — Areen CUBs" };

export default async function ContentItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  await requireWorkerOrAdmin();
  const { itemId } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("content_items")
    .select(`
      id, title, content_type, platform, pillar, caption,
      visual_direction, publish_date, deadline, status, priority,
      client_feedback, approval_status, final_asset_url, task_id,
      assigned_to, created_at, updated_at,
      plan_id,
      profiles:assigned_to(id, full_name, username),
      monthly_content_plans(id, month, year, theme, client_id,
        clients(id, name)
      )
    `)
    .eq("id", itemId)
    .single();

  if (!item) notFound();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .order("full_name", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ContentItemDetailClient item={item as any} members={members ?? []} />;
}
