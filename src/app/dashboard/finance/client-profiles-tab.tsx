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
        <div className="rounded-xl border border-success bg-success-weak p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-success">{tf.clientsGoodPayers}</p>
          <p className="mt-1.5 text-2xl font-bold text-success">{good}</p>
        </div>
        <div className="rounded-xl border border-warning bg-warning-weak p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-warning">{tf.riskLate}</p>
          <p className="mt-1.5 text-2xl font-bold text-warning">{late}</p>
        </div>
        <div className="rounded-xl border border-danger bg-danger-weak p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-danger">{tf.riskRisky}</p>
          <p className="mt-1.5 text-2xl font-bold text-danger">{risky}</p>
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
                      : "bg-surface-3/60 text-content/60 hover:bg-surface-3",
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
            className="w-full max-w-xs rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-content placeholder:text-content/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-content/40">{tf.clientsEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wider text-content/40">
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
                    <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
                      <td className="py-2.5">
                        <Link href={`/dashboard/clients/${c.id}`} className="font-medium text-content hover:text-brand">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right text-content/60">{formatDt(c.invoiced)}</td>
                      <td className="py-2.5 text-right font-semibold text-success">{formatDt(c.paid)}</td>
                      <td className="py-2.5 text-right">
                        {c.unpaid > 0.01
                          ? <span className="font-medium text-warning">{formatDt(c.unpaid)}</span>
                          : <span className="text-content/30">—</span>}
                      </td>
                      <td className="py-2.5 text-right">
                        {c.overdue > 0.01
                          ? <span className="font-bold text-danger">{formatDt(c.overdue)}</span>
                          : <span className="text-content/30">—</span>}
                      </td>
                      <td className="py-2.5 text-right text-content/50">
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
