import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ContentPlanDetailClient } from "./content-plan-detail-client";

export const metadata: Metadata = { title: "Plan de contenu — Areen CUBs" };

export default async function ContentPlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  await requireWorkerOrAdmin();
  const { planId } = await params;
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("monthly_content_plans")
    .select(`
      id, client_id, month, year, theme, goals, status,
      approved_at, created_at,
      clients(id, name)
    `)
    .eq("id", planId)
    .single();

  if (!plan) notFound();

  const { data: items } = await supabase
    .from("content_items")
    .select(`
      id, title, content_type, platform, pillar, caption,
      visual_direction, publish_date, deadline, status, priority,
      client_feedback, approval_status, final_asset_url, task_id,
      assigned_to,
      profiles:assigned_to(id, full_name, username)
    `)
    .eq("plan_id", planId)
    .order("publish_date", { ascending: true, nullsFirst: false });

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .order("full_name", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <ContentPlanDetailClient
      plan={plan as any}
      items={(items ?? []) as any}
      members={members ?? []}
    />
  );
}
