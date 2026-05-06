import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { DevisListTable } from "@/components/devis/devis-list-table";

export default async function FacturesListPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("devis")
    .select(
      "id, kind, devis_number, date, due_date, object, status, payment_status, total_dt, clients:client_id(id, name)",
    )
    .eq("kind", "facture")
    .order("devis_number", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        action={
          <Link href="/dashboard/factures/new">
            <Button>+ Nouvelle facture</Button>
          </Link>
        }
      />
      <DevisListTable rows={data ?? []} kind="facture" />
    </div>
  );
}
