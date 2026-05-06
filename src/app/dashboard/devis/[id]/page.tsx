import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";
import { formatDevisNumber, formatDt, formatDate } from "@/lib/format";
import { DevisStatusActions, RecordPaymentForm, DeleteDevisButton } from "./actions-client";

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

export default async function DevisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: devis } = await supabase
    .from("devis")
    .select(
      "id, devis_number, date, due_date, object, notes, status, payment_status, subtotal_dt, tva_dt, tva_rate, total_dt, clients:client_id(id, name, address, matricule_fiscal), devis_items(id, description, quantity, unit_price_dt, line_total_dt, is_bonus, position)",
    )
    .eq("id", id)
    .single();
  if (!devis) notFound();

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount_dt, paid_at, method, notes")
    .eq("devis_id", id)
    .order("paid_at", { ascending: false });

  const client = Array.isArray(devis.clients) ? devis.clients[0] : devis.clients;
  const items = (devis.devis_items ?? []).slice().sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  const paidSum = (payments ?? []).reduce(
    (s, p) => s + Number(p.amount_dt ?? 0),
    0,
  );
  const remaining = +(Number(devis.total_dt) - paidSum).toFixed(2);

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatDevisNumber(devis.devis_number)}
        subtitle={
          <Link href="/dashboard/devis" className="hover:underline">
            ← Devis
          </Link>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/devis/${devis.id}/print`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" size="sm">
                Imprimer / PDF
              </Button>
            </Link>
            <Link href={`/dashboard/devis/${devis.id}/edit`}>
              <Button variant="outline" size="sm">
                Modifier
              </Button>
            </Link>
            <DeleteDevisButton devisId={devis.id} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Client
            </p>
            <p className="mt-1 font-medium text-slate-900">
              {client?.name ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Date / Échéance
            </p>
            <p className="mt-1 text-sm text-slate-800">
              {formatDate(devis.date)} → {formatDate(devis.due_date)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Statut
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={statusTone[devis.status as keyof typeof statusTone]}>
                {devis.status}
              </Badge>
              <Badge
                tone={
                  paymentTone[
                    devis.payment_status as keyof typeof paymentTone
                  ]
                }
              >
                {devis.payment_status}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Total TTC
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatDt(devis.total_dt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <DevisStatusActions
        devisId={devis.id}
        currentStatus={devis.status as "draft" | "sent" | "accepted" | "rejected"}
      />

      <Card>
        <CardHeader>
          <CardTitle>Lignes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Description</TH>
                <TH className="text-right">P.U.</TH>
                <TH className="text-right">Qté</TH>
                <TH className="text-right">Total ligne</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((it) => (
                <TR key={it.id}>
                  <TD>{it.description}</TD>
                  <TD className="text-right text-slate-600">
                    {it.is_bonus ? "Bonus" : formatDt(it.unit_price_dt)}
                  </TD>
                  <TD className="text-right text-slate-600">{it.quantity}</TD>
                  <TD className="text-right font-medium text-slate-900">
                    {it.is_bonus ? "Bonus" : formatDt(it.line_total_dt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <Row
                label="Sous total"
                value={formatDt(devis.subtotal_dt)}
              />
              <Row
                label={`TVA (${Number(devis.tva_rate).toFixed(0)}%)`}
                value={formatDt(devis.tva_dt)}
              />
              <div className="border-t border-slate-200 pt-2">
                <Row
                  label="Total TTC"
                  value={formatDt(devis.total_dt)}
                  bold
                />
              </div>
              <div className="border-t border-slate-200 pt-2 text-slate-500">
                <Row
                  label="Encaissé"
                  value={formatDt(paidSum)}
                />
                <Row
                  label="Restant"
                  value={formatDt(remaining)}
                  bold={remaining > 0.01}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecordPaymentForm
          devisId={devis.id}
          remaining={remaining}
        />

        <Card>
          <CardHeader>
            <CardTitle>Paiements</CardTitle>
          </CardHeader>
          <CardContent>
            {payments && payments.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0"
                  >
                    <span>
                      {formatDate(p.paid_at)}{" "}
                      {p.method && (
                        <span className="text-slate-500">· {p.method}</span>
                      )}
                    </span>
                    <span className="font-medium text-slate-900">
                      {formatDt(p.amount_dt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Aucun paiement enregistré.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-600"}>
        {label}
      </span>
      <span
        className={
          bold ? "text-base font-semibold text-slate-900" : "text-slate-800"
        }
      >
        {value}
      </span>
    </div>
  );
}
