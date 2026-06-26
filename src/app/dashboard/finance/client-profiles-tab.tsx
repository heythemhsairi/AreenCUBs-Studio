"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDt, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "./finance-client";
import { useI18n } from "@/lib/i18n/provider";

export type ClientProfile = {
  id: string;
  name: string;
  invoiced: number;
  paid: number;
  unpaid: number;
  overdue: number;
  lastPaymentDate: string | null;
  risk: "good" | "late" | "risky";
};

export function ClientProfilesTab({ profiles }: { profiles: ClientProfile[] }) {
  const { t } = useI18n();
  const tf = t.finance;

  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = profiles
    .filter((c) => riskFilter === "all" || c.risk === riskFilter)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const risky = profiles.filter((c) => c.risk === "risky").length;
  const late  = profiles.filter((c) => c.risk === "late").length;
  const good  = profiles.filter((c) => c.risk === "good").length;

  const FILTER_LABELS: Record<string, string> = {
    all:   t.common.all,
    good:  tf.clientsFilterGood,
    late:  tf.clientsFilterLate,
    risky: tf.clientsFilterRisky,
  };

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">{tf.clientsGoodPayers}</p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-300">{good}</p>
        </div>
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">{tf.riskLate}</p>
          <p className="mt-1.5 text-2xl font-bold text-amber-300">{late}</p>
        </div>
        <div className="rounded-xl border border-red-800/50 bg-red-950/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400">{tf.riskRisky}</p>
          <p className="mt-1.5 text-2xl font-bold text-red-300">{risky}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{tf.clientsProfileTitle}</CardTitle>
            <div className="flex gap-1.5">
              {["all", "good", "late", "risky"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRiskFilter(r)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    riskFilter === r
                      ? "bg-brand text-white"
                      : "bg-[#22506F]/60 text-[#F8FAFC]/60 hover:bg-[#22506F]",
                  )}
                >
                  {FILTER_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tf.clientsSearchPlaceholder}
            className="w-full max-w-xs rounded-lg border border-[#22506F] bg-[#0D2D47] px-3 py-1.5 text-sm text-[#F8FAFC] placeholder:text-[#F8FAFC]/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#F8FAFC]/40">{tf.clientsEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#22506F] text-left text-xs font-semibold uppercase tracking-wider text-[#F8FAFC]/40">
                    <th className="pb-2">{tf.colClient}</th>
                    <th className="pb-2 text-right">{tf.colInvoiced}</th>
                    <th className="pb-2 text-right">{tf.colCollected}</th>
                    <th className="pb-2 text-right">{tf.colUnpaid}</th>
                    <th className="pb-2 text-right">{t.filters.overdue}</th>
                    <th className="pb-2 text-right">{tf.clientsColLastPayment}</th>
                    <th className="pb-2 text-right">{tf.colRisk}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-[#22506F]/60 last:border-0 hover:bg-[#1A3E5C]">
                      <td className="py-2.5">
                        <Link href={`/dashboard/clients/${c.id}`} className="font-medium text-[#F8FAFC] hover:text-brand">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right text-[#F8FAFC]/60">{formatDt(c.invoiced)}</td>
                      <td className="py-2.5 text-right font-semibold text-emerald-400">{formatDt(c.paid)}</td>
                      <td className="py-2.5 text-right">
                        {c.unpaid > 0.01
                          ? <span className="font-medium text-amber-400">{formatDt(c.unpaid)}</span>
                          : <span className="text-[#F8FAFC]/30">—</span>}
                      </td>
                      <td className="py-2.5 text-right">
                        {c.overdue > 0.01
                          ? <span className="font-bold text-red-400">{formatDt(c.overdue)}</span>
                          : <span className="text-[#F8FAFC]/30">—</span>}
                      </td>
                      <td className="py-2.5 text-right text-[#F8FAFC]/50">
                        {c.lastPaymentDate ? formatDate(c.lastPaymentDate) : "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        <RiskBadge risk={c.risk} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
