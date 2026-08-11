"use client";

import { formatDt } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

export type AuditData = {
  totalPaymentRecords: number;
  totalFactures: number;
  totalDevis: number;
  convertedDevisCount: number;
  facturePaidNoPaymentRecord: { id: string; devis_number: number; client_name: string; total_dt: number }[];
  devisWithMigratedPayments: { devis_id: string; devis_number: number; client_name: string; migrated_count: number; migrated_amount: number }[];
  duplicateRisk: { devis_id: string; devis_number: number; client_name: string; payment_count: number; total_amount: number }[];
  convertedDevisStillCountedOnDevis: { devis_id: string; devis_number: number; client_name: string; payment_amount: number }[];
  totalCollectedFromFactures: number;
  totalCollectedFromDevis: number;
  migrationCoverage: number;
};

export function AuditTab({ data }: { data: AuditData }) {
  const { t } = useI18n();
  const tf = t.finance;

  const noPay    = data?.facturePaidNoPaymentRecord ?? [];
  const migrated = data?.devisWithMigratedPayments ?? [];
  const dupes    = data?.duplicateRisk ?? [];
  const still    = data?.convertedDevisStillCountedOnDevis ?? [];
  const coverage = data?.migrationCoverage ?? 100;

  const checks = [
    {
      ok: noPay.length === 0,
      label: tf.auditCheck1Label,
      detail: noPay.length === 0 ? tf.auditCheck1Ok : tf.auditCheck1Fail(noPay.length),
    },
    {
      ok: dupes.length === 0,
      label: tf.auditCheck2Label,
      detail: dupes.length === 0 ? tf.auditCheck2Ok : tf.auditCheck2Fail(dupes.length),
    },
    {
      ok: still.length === 0,
      label: tf.auditCheck3Label,
      detail: still.length === 0 ? tf.auditCheck3Ok : tf.auditCheck3Fail(still.length),
    },
    {
      ok: coverage >= 100,
      label: tf.auditCheck4Label,
      detail: tf.auditCheck4Detail(coverage.toFixed(0)),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label={tf.auditSummaryPayments}  value={data.totalPaymentRecords} />
        <SummaryTile label={tf.tabFactures}           value={data.totalFactures} />
        <SummaryTile label={tf.tabDevis}              value={data.totalDevis} />
        <SummaryTile label={tf.auditSummaryConverted} value={data.convertedDevisCount} />
      </div>

      {/* Sanity check totals */}
      <Card>
        <CardHeader><CardTitle>{tf.auditTotalsTitle}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-success-weak p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-success">{tf.auditCollectedLabel}</p>
              <p className="mt-1.5 text-xl font-bold text-success">{formatDt(data.totalCollectedFromFactures)}</p>
              <p className="text-xs text-success/70">{tf.auditCollectedSub}</p>
            </div>
            <div className={cn("rounded-lg p-3", data.totalCollectedFromDevis > 0 ? "bg-warning-weak" : "bg-ink/5")}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-warning">{tf.auditDevisPaymentsLabel}</p>
              <p className={cn("mt-1.5 text-xl font-bold", data.totalCollectedFromDevis > 0 ? "text-warning" : "text-content-3")}>
                {formatDt(data.totalCollectedFromDevis)}
              </p>
              <p className="text-xs text-warning/70">
                {data.totalCollectedFromDevis > 0 ? tf.auditDevisPaymentsPending : tf.auditDevisPaymentsOk}
              </p>
            </div>
            <div className="rounded-lg bg-brand/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark">{tf.auditMigrationLabel}</p>
              <p className={cn("mt-1.5 text-xl font-bold", coverage >= 100 ? "text-success" : "text-warning")}>
                {coverage.toFixed(0)}%
              </p>
              <p className="text-xs text-brand/60">{tf.auditMigrationSub}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrity checks */}
      <Card>
        <CardHeader><CardTitle>{tf.auditChecksTitle}</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-line">
            {checks.map((c, i) => (
              <li key={i} className="flex items-start gap-3 py-3">
                <span className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  c.ok ? "bg-success-weak text-success" : "bg-danger-weak text-danger",
                )}>
                  {c.ok ? "✓" : "!"}
                </span>
                <div>
                  <p className={cn("text-sm font-semibold", c.ok ? "text-success" : "text-danger")}>{c.label}</p>
                  <p className="text-xs text-content/55">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Factures paid but no payment record */}
      {noPay.length > 0 && (
        <Card className="border-danger">
          <CardHeader>
            <CardTitle className="text-danger">{tf.auditNoPayTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wider text-content/40">
                    <th className="pb-2">N°</th>
                    <th className="pb-2">{tf.colClient}</th>
                    <th className="pb-2 text-right">{tf.colAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {noPay.map((f) => (
                    <tr key={f.id} className="border-b border-line/50 last:border-0">
                      <td className="py-2 font-mono text-xs text-content/70">FACT-{String(f.devis_number).padStart(7, "0")}</td>
                      <td className="py-2 text-content">{f.client_name}</td>
                      <td className="py-2 text-right font-semibold text-danger">{formatDt(f.total_dt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-content/50">{tf.auditNoPayNote}</p>
          </CardContent>
        </Card>
      )}

      {/* Devis with migrated payments */}
      {migrated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{tf.auditMigratedTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wider text-content/40">
                    <th className="pb-2">{tf.tabDevis}</th>
                    <th className="pb-2">{tf.colClient}</th>
                    <th className="pb-2 text-right">{tf.auditColMigrated}</th>
                    <th className="pb-2 text-right">{tf.auditColMigratedAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {migrated.map((d) => (
                    <tr key={d.devis_id} className="border-b border-line/50 last:border-0">
                      <td className="py-2 font-mono text-xs text-content/70">EST-{String(d.devis_number).padStart(7, "0")}</td>
                      <td className="py-2 text-content">{d.client_name}</td>
                      <td className="py-2 text-right text-content/70">{d.migrated_count}</td>
                      <td className="py-2 text-right font-semibold text-success">{formatDt(d.migrated_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-content/50">{tf.auditMigratedNote}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-content/45">{label}</p>
      <p className="mt-2 text-2xl font-bold text-accent2">{value}</p>
    </div>
  );
}
