"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { formatDevisNumber, formatDt, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

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

const rowAccent: Record<string, string> = {
  paid: "before:bg-emerald-400",
  partial: "before:bg-brand",
  unpaid: "before:bg-accent",
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
          const accent = rowAccent[d.payment_status] ?? "before:bg-ink/10";
          return (
            <tr
              key={d.id}
              className={cn(
                "relative transition-colors duration-150 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r-full hover:bg-cream/70",
                accent,
              )}
            >
              <TD className="pl-5 font-mono text-xs text-ink/55">
                <Link href={`${baseUrl}/${d.id}`} className="hover:text-brand">
                  {formatDevisNumber(d.devis_number, kind)}
                </Link>
              </TD>
              <TD className="font-medium text-ink">{client?.name ?? "—"}</TD>
              <TD className="text-ink/60">{formatDate(d.date)}</TD>
              <TD className="text-ink/60">{formatDate(d.due_date)}</TD>
              <TD>
                <Badge
                  tone={statusTone[d.status as keyof typeof statusTone]}
                  dot={d.status === "sent" ? "pulse" : true}
                >
                  {statusLabel[d.status] ?? d.status}
                </Badge>
              </TD>
              <TD>
                <Badge
                  tone={paymentTone[d.payment_status as keyof typeof paymentTone]}
                  dot={d.payment_status === "partial" ? "pulse" : true}
                >
                  {paymentLabel[d.payment_status] ?? d.payment_status}
                </Badge>
              </TD>
              <TD className="text-right font-semibold text-ink">
                {formatDt(d.total_dt)}
              </TD>
            </tr>
          );
        })}
      </TBody>
    </Table>
  );
}
