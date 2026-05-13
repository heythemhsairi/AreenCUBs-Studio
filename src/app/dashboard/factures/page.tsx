import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { DevisListView } from "@/components/devis/devis-list-view";

export default async function FacturesListPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: rows }, { data: clients }] = await Promise.all([
    supabase
      .from("devis")
      .select(
        "id, kind, devis_number, date, due_date, object, status, payment_status, total_dt, clients:client_id(id, name)",
      )
      .eq("kind", "facture")
      .order("devis_number", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name")
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        description="Toutes les factures émises. Filtrez par statut, paiement, client ou période."
        action={
          <Link href="/dashboard/factures/new">
            <Button>+ Nouvelle facture</Button>
          </Link>
        }
      />
      <DevisListView
        rows={rows ?? []}
        kind="facture"
        clients={(clients ?? []).map((c) => ({ value: c.id, label: c.name }))}
      />
    </div>
  );
}
