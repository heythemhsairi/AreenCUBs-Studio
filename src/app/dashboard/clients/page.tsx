import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientsListClient } from "./list-client";

export default async function ClientsPage() {
  await requireWorkerOrAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, email, phone, created_at, projects(count)")
    .order("created_at", { ascending: false });

  const rows = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    created_at: c.created_at,
    projects_count:
      Array.isArray(c.projects) && c.projects[0] ? c.projects[0].count : 0,
  }));

  return <ClientsListClient clients={rows} />;
}
