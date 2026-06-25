import type { Metadata } from "next";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ContentCalendarClient } from "./content-calendar-client";

export const metadata: Metadata = { title: "Calendrier contenu — Areen CUBs" };

export default async function ContentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; month?: string; year?: string }>;
}) {
  await requireWorkerOrAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  const now = new Date();
  const monthParam = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;
  const yearParam = params.year ? parseInt(params.year, 10) : now.getFullYear();

  const startDate = `${yearParam}-${String(monthParam).padStart(2, "0")}-01`;
  const endDate = new Date(yearParam, monthParam, 0);
  const endDateStr = `${yearParam}-${String(monthParam).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  let query = supabase
    .from("content_items")
    .select(`
      id, title, content_type, platform, status, priority, publish_date,
      client_id,
      assigned_to,
      profiles:assigned_to(id, full_name, username),
      clients(id, name)
    `)
    .gte("publish_date", startDate)
    .lte("publish_date", endDateStr)
    .order("publish_date", { ascending: true });

  if (params.client) {
    query = query.eq("client_id", params.client);
  }

  // Fetch social posts scheduled in this month
  const socialQuery = supabase
    .from("social_posts")
    .select("id, title, platforms, status, scheduled_at")
    .gte("scheduled_at", `${startDate}T00:00:00`)
    .lte("scheduled_at", `${endDateStr}T23:59:59`)
    .in("status", ["scheduled", "published"])
    .order("scheduled_at", { ascending: true });

  const [{ data: items }, { data: clients }, { data: socialPosts }] = await Promise.all([
    query,
    supabase.from("clients").select("id, name").order("name", { ascending: true }),
    socialQuery,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <ContentCalendarClient
      items={(items ?? []) as any}
      clients={clients ?? []}
      month={monthParam}
      year={yearParam}
      clientFilter={params.client ?? null}
      socialPosts={(socialPosts ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        platforms: (p.platforms as string[] | null) ?? [],
        status: p.status as string,
        scheduled_at: p.scheduled_at as string,
      }))}
    />
  );
}
