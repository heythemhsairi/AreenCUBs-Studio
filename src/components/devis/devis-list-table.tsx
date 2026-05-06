"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
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

const statusLabel: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
};

const paymentLabel: Record<string, string> = {
  unpaid: "Impayé",
  partial: "Partiel",
  paid: "Payé",
};

type Row = {
  id: string;
  kind?: "devis" | "facture";
  devis_number: number;
  date: string;
  due_date: string;
  object: string | null;
  status: string;
  payment_status: string;
  total_dt: number;
  clients: { id: string; name: string } | { id: string; name: string }[] | null;
};

export function DevisListTable({
  rows,
  kind,
}: {
  rows: Row[];
  kind: "devis" | "facture";
}) {
  if (rows.length === 0) {
    return (
      <EmptyState>
        Aucun{kind === "facture" ? "e facture" : " devis"}. Créez le premier.
      </EmptyState>
    );
  }

  const baseUrl = kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";

  return (
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
        {rows.map((d) => {
          const client = Array.isArray(d.clients) ? d.clients[0] : d.clients;
          return (
            <TR key={d.id}>
              <TD className="font-mono text-xs text-ink/50">
                <Link href={`${baseUrl}/${d.id}`} className="hover:text-brand">
                  {formatDevisNumber(d.devis_number, kind)}
                </Link>
              </TD>
              <TD className="font-medium text-ink">{client?.name ?? "—"}</TD>
              <TD className="text-ink/60">{formatDate(d.date)}</TD>
              <TD className="text-ink/60">{formatDate(d.due_date)}</TD>
              <TD>
                <Badge tone={statusTone[d.status as keyof typeof statusTone]}>
                  {statusLabel[d.status] ?? d.status}
                </Badge>
              </TD>
              <TD>
                <Badge
                  tone={paymentTone[d.payment_status as keyof typeof paymentTone]}
                >
                  {paymentLabel[d.payment_status] ?? d.payment_status}
                </Badge>
              </TD>
              <TD className="text-right font-medium text-ink">
                {formatDt(d.total_dt)}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
