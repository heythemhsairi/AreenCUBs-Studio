"use client";

import { formatDt, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AuditData = {
  // Summary counts
  totalPaymentRecords: number;
  totalFactures: number;
  totalDevis: number;
  convertedDevisCount: number;

  // Integrity findings
  facturePaidNoPaymentRecord: { id: string; devis_number: number; client_name: string; total_dt: number }[];
  devisWithMigratedPayments: { devis_id: string; devis_number: number; client_name: string; migrated_count: number; migrated_amount: number }[];
  duplicateRisk: { devis_id: string; devis_number: number; client_name: string; payment_count: number; total_amount: number }[];
  convertedDevisStillCountedOnDevis: { devis_id: string; devis_number: number; client_name: string; payment_amount: number }[];

  // Totals for sanity check
  totalCollectedFromFactures: number;
  totalCollectedFromDevis: number; // should be 0 ideally (all migrated)
  migrationCoverage: number; // % of converted devis that had payments migrated
};

type AuditItem = {
  ok: boolean;
  label: string;
  detail: string;
};

export function AuditTab({ data }: { data: AuditData }) {
  // Defensive: ensure all arrays are arrays even if server passed null/undefined
  const noPay  = data?.facturePaidNoPaymentRecord ?? [];
  const migrated = data?.devisWithMigratedPayments ?? [];
  const dupes  = data?.duplicateRisk ?? [];
  const still  = data?.convertedDevisStillCountedOnDevis ?? [];

  const checks: AuditItem[] = [
    {
      ok: noPay.length === 0,
      label: "Factures payées avec enregistrement de paiement",
      detail: noPay.length === 0
        ? "Toutes les factures payées ont au moins un paiement enregistré."
        : `${noPay.length} facture(s) marquée(s) payée(s) sans aucun paiement.`,
    },
    {
      ok: dupes.length === 0,
      label: "Aucun doublon de paiement détecté",
      detail: dupes.length === 0
        ? "Aucun doublon détecté sur les factures."
        : `${dupes.length} facture(s) avec des paiements potentiellement dupliqués.`,
    },
    {
      ok: still.length === 0,
      label: "Paiements devis convertis exclus du CA",
      detail: still.length === 0
        ? "Aucun devis converti ne double-compte ses paiements."
        : `${still.length} devis converti(s) avec des paiements non marqués comme superseded.`,
    },
    {
      ok: (data?.migrationCoverage ?? 100) >= 100,
      label: "Migration paiements devis → factures",
      detail: `${(data?.migrationCoverage ?? 100).toFixed(0)}% des devis convertis ont leurs paiements transférés sur la facture.`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Enregistrements paiements" value={data.totalPaymentRecords} />
        <SummaryTile label="Factures" value={data.totalFactures} />
        <SummaryTile label="Devis" value={data.totalDevis} />
        <SummaryTile label="Devis convertis" value={data.convertedDevisCount} />
      </div>

      {/* Sanity check totals */}
      <Card>
        <CardHeader><CardTitle>Vérification des totaux</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Encaissé (factures)</p>
              <p className="mt-1.5 text-xl font-bold text-emerald-800">{formatDt(data.totalCollectedFromFactures)}</p>
              <p className="text-xs text-emerald-600/70">Source of truth</p>
            </div>
            <div className={cn("rounded-lg p-3", data.totalCollectedFromDevis > 0 ? "bg-amber-50" : "bg-ink/5")}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Paiements sur devis</p>
              <p className={cn("mt-1.5 text-xl font-bold", data.totalCollectedFromDevis > 0 ? "text-amber-800" : "text-ink/50")}>{formatDt(data.totalCollectedFromDevis)}</p>
              <p className="text-xs text-amber-600/70">
                {data.totalCollectedFromDevis > 0 ? "Devis sans facture liée" : "OK — tout migré"}
              </p>
            </div>
            <div className="rounded-lg bg-brand/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark">Couverture migration</p>
              <p className={cn("mt-1.5 text-xl font-bold", data.migrationCoverage >= 100 ? "text-emerald-700" : "text-amber-700")}>
                {data.migrationCoverage.toFixed(0)}%
              </p>
              <p className="text-xs text-brand/60">Paiements transférés</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrity checks */}
      <Card>
        <CardHeader><CardTitle>Contrôles d&apos;intégrité</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-ink/8">
            {checks.map((c, i) => (
              <li key={i} className="flex items-start gap-3 py-3">
                <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", c.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                  {c.ok ? "✓" : "!"}
                </span>
                <div>
                  <p className={cn("text-sm font-semibold", c.ok ? "text-ink" : "text-red-700")}>{c.label}</p>
                  <p className="text-xs text-ink/55">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Factures paid but no payment record */}
      {noPay.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Factures payées sans paiement enregistré</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/8 text-left text-xs font-semibold uppercase tracking-wider text-ink/40">
                    <th className="pb-2">N°</th>
                    <th className="pb-2">Client</th>
                    <th className="pb-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {noPay.map((f) => (
                    <tr key={f.id} className="border-b border-ink/5 last:border-0">
                      <td className="py-2 font-mono text-xs text-ink/70">FACT-{String(f.devis_number).padStart(7, "0")}</td>
                      <td className="py-2 text-ink">{f.client_name}</td>
                      <td className="py-2 text-right font-semibold text-red-600">{formatDt(f.total_dt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-ink/50">
              Ces factures ont le statut &quot;payé&quot; mais aucun enregistrement dans la table payments. La migration a peut-être raté ou les paiements ont été supprimés. Utilisez l&apos;action &quot;Marquer payé&quot; pour les corriger.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Devis with migrated payments */}
      {migrated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Devis convertis avec paiements migrés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/8 text-left text-xs font-semibold uppercase tracking-wider text-ink/40">
                    <th className="pb-2">Devis</th>
                    <th className="pb-2">Client</th>
                    <th className="pb-2 text-right">Paiements migrés</th>
                    <th className="pb-2 text-right">Montant total</th>
                  </tr>
                </thead>
                <tbody>
                  {migrated.map((d) => (
                    <tr key={d.devis_id} className="border-b border-ink/5 last:border-0">
                      <td className="py-2 font-mono text-xs text-ink/70">EST-{String(d.devis_number).padStart(7, "0")}</td>
                      <td className="py-2 text-ink">{d.client_name}</td>
                      <td className="py-2 text-right text-ink/70">{d.migrated_count}</td>
                      <td className="py-2 text-right font-semibold text-emerald-700">{formatDt(d.migrated_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-ink/50">Ces devis avaient des paiements au moment de la conversion. Les paiements ont été copiés sur la facture correspondante.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink/8 bg-white/50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
