import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DevisListView } from "@/components/devis/devis-list-view";

export default async function DevisListPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: rows }, { data: clients }] = await Promise.all([
    supabase
      .from("devis")
      .select(
        "id, kind, devis_number, date, due_date, object, status, payment_status, total_dt, clients:client_id(id, name)",
      )
      .eq("kind", "devis")
      .order("devis_number", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name")
      .order("name", { ascending: true }),
  ]);

  return (
    <DevisListView
      rows={rows ?? []}
      kind="devis"
      clients={(clients ?? []).map((c) => ({ value: c.id, label: c.name }))}
    />
  );
}
