"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";
import { formatDevisNumber, formatDt, formatDate } from "@/lib/format";
import {
  DevisStatusActions,
  PaymentSection,
  DeleteDevisButton,
  ConvertToFactureButton,
} from "./actions-client";

type DevisItem = {
  id: string;
  description: string | null;
  quantity: number;
  unit_price_dt: number;
  line_total_dt: number;
  is_bonus: boolean;
  position: number | null;
};

type Payment = {
  id: string;
  amount_dt: number;
  paid_at: string;
  method: string | null;
  notes: string | null;
};

type Props = {
  id: string;
  kind: "devis" | "facture";
  devisNumber: number;
  date: string;
  dueDate: string | null;
  status: string;
  paymentStatus: string;
  subtotalDt: number;
  discountDt: number;
  tvaDt: number;
  tvaRate: number;
  totalDt: number;
  clientName: string | null;
  items: DevisItem[];
  payments: Payment[];
  paidSum: number;
  parent: { id: string; devis_number: number; kind: string } | null;
  derivedFacture: { id: string; devis_number: number } | null;
};

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-ink" : "text-ink/60"}>{label}</span>
      <span className={bold ? "font-semibold text-ink" : "text-ink"}>{value}</span>
    </div>
  );
}

export function DevisDetailClient({
  id,
  kind,
  devisNumber,
  date,
  dueDate,
  status,
  paymentStatus,
  subtotalDt,
  discountDt,
  tvaDt,
  tvaRate,
  totalDt,
  clientName,
  items,
  payments,
  paidSum,
  parent,
  derivedFacture,
}: Props) {
  const { t } = useI18n();

  const docLabel = kind === "facture" ? t.factures.title.replace(/s$/, "") : t.devis.title;
  const baseListUrl = kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";
  const backLabel = kind === "facture" ? t.factures.title : t.devis.title;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${docLabel} ${formatDevisNumber(devisNumber, kind)}`}
        subtitle={
          <Link href={baseListUrl} className="hover:underline">
            ← {backLabel}
          </Link>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {kind === "devis" && !derivedFacture && (
              <ConvertToFactureButton devisId={id} />
            )}
            <Link href={`/devis/${id}/print`} target="_blank" rel="noreferrer">
              <Button variant="ink" size="sm">{t.common.print}</Button>
            </Link>
            <Link href={`${baseListUrl}/${id}/edit`}>
              <Button variant="outline" size="sm">{t.common.edit}</Button>
            </Link>
            <DeleteDevisButton devisId={id} kind={kind} />
          </div>
        }
      />

      {(parent || derivedFacture) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {parent && (
            <Link
              href={`/dashboard/${parent.kind === "facture" ? "factures" : "devis"}/${parent.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 font-semibold text-brand-dark hover:bg-brand/15"
            >
              {t.devis.issuedFrom} {formatDevisNumber(parent.devis_number, parent.kind as "devis" | "facture")}
            </Link>
          )}
          {derivedFacture && (
            <Link
              href={`/dashboard/factures/${derivedFacture.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 font-semibold text-accent-dark hover:bg-accent/25"
            >
              {t.devis.invoicedUnder} {formatDevisNumber(derivedFacture.devis_number, "facture")}
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-ink/50">{t.devis.labelClient}</p>
            <p className="mt-1 font-medium text-ink">{clientName ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-ink/50">{t.devis.labelDateDue}</p>
            <p className="mt-1 text-sm text-ink">
              {formatDate(date)} → {dueDate ? formatDate(dueDate) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-ink/50">{t.devis.labelStatus}</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={status} type="devis" />
              <StatusBadge status={paymentStatus} type="finance" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-ink/50">{t.devis.totalTtc}</p>
            <p className="mt-1 text-lg font-semibold text-ink">{formatDt(totalDt)}</p>
          </CardContent>
        </Card>
      </div>

      <DevisStatusActions
        devisId={id}
        currentStatus={status as "draft" | "sent" | "accepted" | "rejected"}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t.devisBuilder.linesCard}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>{t.devisBuilder.colDescription}</TH>
                <TH className="text-right">{t.devisBuilder.colUnit}</TH>
                <TH className="text-right">{t.devisBuilder.colQty}</TH>
                <TH className="text-right">{t.devisBuilder.colTotal}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((it) => (
                <TR key={it.id}>
                  <TD>{it.description}</TD>
                  <TD className="text-right text-ink/60">
                    {it.is_bonus ? t.devisBuilder.colBonus : formatDt(it.unit_price_dt)}
                  </TD>
                  <TD className="text-right text-ink/60">{it.quantity}</TD>
                  <TD className="text-right font-medium text-ink">
                    {it.is_bonus ? t.devisBuilder.colBonus : formatDt(it.line_total_dt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <Row label={t.devis.subtotal} value={formatDt(subtotalDt)} />
              {discountDt > 0 && (
                <Row label={t.devis.discount} value={`− ${formatDt(discountDt)}`} />
              )}
              <Row
                label={`${t.devis.tva} (${Number(tvaRate).toFixed(0)}%)`}
                value={formatDt(tvaDt)}
              />
              <div className="border-t border-ink/10 pt-2">
                <Row label={t.devis.totalTtc} value={formatDt(totalDt)} bold />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaymentSection devisId={id} totalDt={totalDt} paidDt={paidSum} />

        <Card>
          <CardHeader>
            <CardTitle>{t.devis.paymentsCard}</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between border-b border-ink/5 pb-2 last:border-0"
                  >
                    <span>
                      {formatDate(p.paid_at)}{" "}
                      {p.method && <span className="text-ink/50">· {p.method}</span>}
                    </span>
                    <span className="font-medium text-ink">{formatDt(p.amount_dt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/50">{t.devis.noPayments}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
