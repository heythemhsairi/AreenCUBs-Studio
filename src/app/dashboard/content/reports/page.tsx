import type { Metadata } from "next";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ContentReportsClient } from "./content-reports-client";

export const metadata: Metadata = { title: "Rapports contenu — Areen CUBs" };

export default async function ContentReportsPage() {
  await requireWorkerOrAdmin();
  const supabase = await createClient();

  // Fetch all plans with their items for reporting
  const { data: plans } = await supabase
    .from("monthly_content_plans")
    .select(`
      id, client_id, month, year, theme, status, approved_at,
      clients(id, name),
      content_items(id, status, content_type, platform, approval_status, publish_date)
    `)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ContentReportsClient plans={(plans ?? []) as any} />;
}
