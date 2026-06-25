import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientContentProfileClient } from "./client-content-profile-client";

export const metadata: Metadata = { title: "Profil contenu — Areen CUBs" };

export default async function ClientContentProfilePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireWorkerOrAdmin();
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const { data: profile } = await supabase
    .from("client_content_profiles")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  const { data: plans } = await supabase
    .from("monthly_content_plans")
    .select(`
      id, month, year, theme, status, goals, approved_at, created_at,
      content_items(id, status, content_type, platform)
    `)
    .eq("client_id", clientId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .order("full_name", { ascending: true });

  return (
    <ClientContentProfileClient
      client={client}
      profile={profile ?? null}
      plans={plans ?? []}
      members={members ?? []}
    />
  );
}
