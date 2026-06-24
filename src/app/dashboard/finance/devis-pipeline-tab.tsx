"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDt, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/provider";
import type { DevisRow } from "./finance-client";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[#22506F] text-[#94A3B8]",
  sent: "bg-blue-900/50 text-blue-300",
  accepted: "bg-emerald-900/50 text-emerald-300",
  rejected: "bg-red-900/50 text-red-400",
};

export function DevisPipelineTab({
  rows, totalSent, totalAccepted, totalRejected,
  conversionRate, expectedRevenue, lostRevenue, avgDealSize,
}: {
  rows: DevisRow[];
  totalSent: number; totalAccepted: number; totalRejected: number;
  conversionRate: number; expectedRevenue: number; lostRevenue: number; avgDealSize: number;
}) {
  const { t } = useI18n();
  const STATUS_LABELS: Record<string, string> = {
    draft: t.devis.status.draft,
    sent: t.devis.status.sent,
    accepted: t.devis.status.accepted,
    rejected: t.devis.status.rejected,
  };
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? rows : rows.filter((d) => d.status === filter);

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PipelineStat label="Devis envoyés" value={`${totalSent}`} sub="12 derniers mois" />
        <PipelineStat label="Acceptés" value={`${totalAccepted}`} sub={`${conversionRate.toFixed(0)}% de conversion`} highlight="green" />
        <PipelineStat label="Refusés" value={`${totalRejected}`} sub={`CA perdu : ${formatDt(lostRevenue)}`} highlight="red" />
        <PipelineStat label="Deal moyen" value={formatDt(avgDealSize)} sub="Devis acceptés" />
      </div>

      {/* Conversion funnel */}
      <Card>
        <CardHeader><CardTitle>Entonnoir de conversion</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { label: "Envoyés", count: totalSent, color: "bg-blue-400", pct: 100 },
              { label: "Acceptés", count: totalAccepted, color: "bg-emerald-500", pct: totalSent > 0 ? (totalAccepted/totalSent)*100 : 0 },
              { label: "CA espéré", count: null, color: "bg-brand", pct: null, value: formatDt(expectedRevenue) },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-medium text-[#F8FAFC]/60">{row.label}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-[#22506F] h-2.5">
                  <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${row.pct ?? 100}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-semibold text-[#F8FAFC]">
                  {row.value ?? row.count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Devis list */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Liste des devis</CardTitle>
            <div className="flex gap-1">
              {["all", "sent", "accepted", "rejected", "draft"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    filter === s ? "bg-brand text-white" : "bg-[#22506F] text-[#F8FAFC]/60 hover:bg-[#1A3E5C]",
                  )}
                >
                  {s === "all" ? t.common.all : STATUS_LABELS[s] ?? s}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#F8FAFC]/40">Aucun devis pour ce filtre.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#22506F] text-left text-xs font-semibold uppercase tracking-wider text-[#F8FAFC]/40">
                    <th className="pb-2">N°</th>
                    <th className="pb-2">Client</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Échéance</th>
                    <th className="pb-2">Statut</th>
                    <th className="pb-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b border-[#22506F] last:border-0 hover:bg-[#1A3E5C]">
                      <td className="py-2.5">
                        <Link href={`/dashboard/devis/${d.id}`} className="font-mono text-xs text-brand hover:underline">
                          #{d.devis_number}
                        </Link>
                      </td>
                      <td className="py-2.5 font-medium text-[#F8FAFC]">{d.client_name}</td>
                      <td className="py-2.5 text-[#F8FAFC]/55">{formatDate(d.date)}</td>
                      <td className="py-2.5 text-[#F8FAFC]/55">{formatDate(d.due_date)}</td>
                      <td className="py-2.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLORS[d.status] ?? "bg-[#22506F] text-[#94A3B8]")}>
                          {STATUS_LABELS[d.status] ?? d.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-[#F8FAFC]">{formatDt(d.total_dt)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#22506F]">
                    <td colSpan={5} className="pt-2.5 text-xs font-semibold uppercase tracking-wider text-[#F8FAFC]/50">Total</td>
                    <td className="pt-2.5 text-right font-bold text-[#22D3EE]">{formatDt(filtered.reduce((s,d)=>s+d.total_dt,0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PipelineStat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: "green" | "red" }) {
  return (
    <div className="rounded-xl border border-[#22506F] bg-[#0D2D47] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#F8FAFC]/45">{label}</p>
      <p className={cn(
        "mt-2 text-2xl font-bold",
        highlight === "green" ? "text-emerald-400" : highlight === "red" ? "text-red-400" : "text-[#F8FAFC]",
      )}>{value}</p>
      <p className="mt-0.5 text-[11px] text-[#F8FAFC]/45">{sub}</p>
    </div>
  );
}
