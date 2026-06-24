"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDt, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "./finance-client";

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
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = profiles
    .filter((c) => riskFilter === "all" || c.risk === riskFilter)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const risky = profiles.filter((c) => c.risk === "risky").length;
  const late  = profiles.filter((c) => c.risk === "late").length;
  const good  = profiles.filter((c) => c.risk === "good").length;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Bons payeurs</p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-300">{good}</p>
        </div>
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">En retard</p>
          <p className="mt-1.5 text-2xl font-bold text-amber-300">{late}</p>
        </div>
        <div className="rounded-xl border border-red-800/50 bg-red-950/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400">Risqués</p>
          <p className="mt-1.5 text-2xl font-bold text-red-300">{risky}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Profil financier clients</CardTitle>
            <div className="flex gap-1.5">
              {["all","good","late","risky"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRiskFilter(r)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    riskFilter === r
                      ? "bg-brand text-white"
                      : "bg-[#263244]/60 text-[#F8FAFC]/60 hover:bg-[#263244]",
                  )}
                >
                  {r === "all" ? "Tous" : r === "good" ? "Bon" : r === "late" ? "En retard" : "Risqué"}
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
            placeholder="Rechercher un client…"
            className="w-full max-w-xs rounded-lg border border-[#263244] bg-[#111827] px-3 py-1.5 text-sm text-[#F8FAFC] placeholder:text-[#F8FAFC]/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#F8FAFC]/40">Aucun client avec des factures.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#263244] text-left text-xs font-semibold uppercase tracking-wider text-[#F8FAFC]/40">
                    <th className="pb-2">Client</th>
                    <th className="pb-2 text-right">Facturé</th>
                    <th className="pb-2 text-right">Encaissé</th>
                    <th className="pb-2 text-right">Impayé</th>
                    <th className="pb-2 text-right">En retard</th>
                    <th className="pb-2 text-right">Dernier paiement</th>
                    <th className="pb-2 text-right">Risque</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-[#263244]/60 last:border-0 hover:bg-[#1E2A3A]">
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
