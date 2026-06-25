import type { Metadata } from "next";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ContentHubClient } from "./content-hub-client";

export const metadata: Metadata = { title: "Content OS — Areen CUBs" };

export default async function ContentOSPage() {
  await requireWorkerOrAdmin();
  const supabase = await createClient();

  // Load all clients with their content plans summary
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email")
    .order("name", { ascending: true });

  // Load all content plans with item counts
  const { data: plans } = await supabase
    .from("monthly_content_plans")
    .select(`
      id, client_id, month, year, theme, status, created_at,
      content_items(id, status)
    `)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  // Load all content profiles
  const { data: profiles } = await supabase
    .from("client_content_profiles")
    .select("client_id, brand_voice, platforms, posting_frequency");

  return (
    <ContentHubClient
      clients={clients ?? []}
      plans={plans ?? []}
      profiles={profiles ?? []}
    />
  );
}
