import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";
import { formatDevisNumber, formatDt, formatDate } from "@/lib/format";

const statusTone = {
  draft: "slate",
  sent: "blue",
  accepted: "green",
  rejected: "red",
} as const;

const paymentTone = {
  unpaid: "amber",
  partial: "blue",
  paid: "green",
} as const;

export default async function DevisListPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("devis")
    .select(
      "id, devis_number, date, due_date, object, status, payment_status, total_dt, clients:client_id(id, name)",
    )
    .order("devis_number", { ascending: false });

  const rows = (data ?? []).map((d) => {
    const client = Array.isArray(d.clients) ? d.clients[0] : d.clients;
    return { ...d, client };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devis"
        action={
          <Link href="/dashboard/devis/new">
            <Button>+ Nouveau devis</Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState>Aucun devis. Créez le premier.</EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>N°</TH>
              <TH>Client</TH>
              <TH>Date</TH>
              <TH>Échéance</TH>
              <TH>Statut</TH>
              <TH>Paiement</TH>
              <TH className="text-right">Total TTC</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((d) => (
              <TR key={d.id}>
                <TD className="font-mono text-xs text-slate-500">
                  <Link
                    href={`/dashboard/devis/${d.id}`}
                    className="hover:text-brand"
                  >
                    {formatDevisNumber(d.devis_number)}
                  </Link>
                </TD>
                <TD className="font-medium text-slate-900">
                  {d.client?.name ?? "—"}
                </TD>
                <TD className="text-slate-600">{formatDate(d.date)}</TD>
                <TD className="text-slate-600">{formatDate(d.due_date)}</TD>
                <TD>
                  <Badge tone={statusTone[d.status as keyof typeof statusTone]}>
                    {d.status}
                  </Badge>
                </TD>
                <TD>
                  <Badge
                    tone={
                      paymentTone[d.payment_status as keyof typeof paymentTone]
                    }
                  >
                    {d.payment_status}
                  </Badge>
                </TD>
                <TD className="text-right font-medium text-slate-900">
                  {formatDt(d.total_dt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
