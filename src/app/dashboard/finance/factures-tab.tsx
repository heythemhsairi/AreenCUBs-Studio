"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDt, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/provider";
import type { FactureWithBalance } from "./finance-client";

export function FacturesTab({
  rows, clients, today,
}: {
  rows: FactureWithBalance[];
  clients: { id: string; name: string }[];
  today: string;
}) {
  const { t } = useI18n();
  const tf = t.finance;

  const STATUS_META: Record<string, { label: string; cls: string }> = {
    draft:     { label: t.devis.status.draft,    cls: "bg-[#22506F] text-[#94A3B8]" },
    sent:      { label: t.devis.status.sent,     cls: "bg-blue-900/40 text-blue-300" },
    partial:   { label: t.devis.payment.partial, cls: "bg-amber-900/40 text-amber-300" },
    paid:      { label: t.devis.payment.paid,    cls: "bg-emerald-900/40 text-emerald-300" },
    overdue:   { label: t.filters.overdue,       cls: "bg-red-900/40 text-red-400" },
    cancelled: { label: t.devis.status.rejected, cls: "bg-[#22506F] text-[#94A3B8] line-through" },
  };

  const [filter, setFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const filtered = rows
    .filter((f) => filter === "all" || f.computed_status === filter)
    .filter((f) => clientFilter === "all" || f.client_id === clientFilter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const counts: Record<string, number> = {};
  for (const f of rows) {
    counts[f.computed_status] = (counts[f.computed_status] ?? 0) + 1;
  }

  const totalPaid    = rows.filter((f) => f.computed_status === "paid").reduce((s, f) => s + f.total_dt, 0);
  const totalUnpaid  = rows.filter((f) => ["sent","partial","overdue"].includes(f.computed_status)).reduce((s, f) => s + f.balance_dt, 0);
  const totalOverdue = rows.filter((f) => f.computed_status === "overdue").reduce((s, f) => s + f.balance_dt, 0);

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <FactureStat label={tf.facturesStatTotal}   value={rows.reduce((s, f) => s + f.total_dt, 0)} />
        <FactureStat label={tf.facturesStatPaid}    value={totalPaid}    color="text-emerald-400" />
        <FactureStat label={tf.facturesStatBalance} value={totalUnpaid}  color={totalUnpaid  > 0 ? "text-amber-400" : "text-[#F8FAFC]"} />
        <FactureStat label={tf.facturesStatOverdue} value={totalOverdue} color={totalOverdue > 0 ? "text-red-400"   : "text-[#F8FAFC]"} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{tf.facturesTitle}</CardTitle>
            <Link
              href="/dashboard/factures/new"
              className="rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              {tf.facturesNew}
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
              {t.common.all} ({rows.length})
            </FilterPill>
            {(["overdue","sent","partial","paid","draft","cancelled"] as const).map((s) =>
              counts[s] ? (
                <FilterPill key={s} active={filter === s} onClick={() => setFilter(s)}>
                  {STATUS_META[s].label} ({counts[s]})
                </FilterPill>
              ) : null,
            )}
          </div>

          {/* Client filter */}
          {clients.length > 0 && (
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="rounded-lg border border-[#22506F] bg-[#0D2D47] px-3 py-1.5 text-xs text-[#F8FAFC] focus:border-brand focus:outline-none"
            >
              <option value="all">{t.filters.allClients}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#94A3B8]">{tf.facturesEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#22506F] text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    <th className="pb-2">N°</th>
                    <th className="pb-2">{tf.colClient}</th>
                    <th className="pb-2">{tf.colDate}</th>
                    <th className="pb-2">{tf.colDue}</th>
                    <th className="pb-2">{tf.colStatus}</th>
                    <th className="pb-2 text-right">{tf.colTotal}</th>
                    <th className="pb-2 text-right">{tf.colPaid}</th>
                    <th className="pb-2 text-right">{tf.colBalance}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => {
                    const meta = STATUS_META[f.computed_status] ?? STATUS_META.sent;
                    const client = clients.find((c) => c.id === f.client_id);
                    return (
                      <tr key={f.id} className="border-b border-[#22506F] last:border-0 hover:bg-[#1A3E5C]">
                        <td className="py-2.5">
                          <Link href={`/dashboard/factures/${f.id}`} className="font-mono text-xs text-brand hover:underline">
                            #{f.devis_number}
                          </Link>
                        </td>
                        <td className="py-2.5 font-medium text-[#F8FAFC]">
                          {client
                            ? <Link href={`/dashboard/clients/${client.id}`} className="hover:text-brand">{client.name}</Link>
                            : "—"}
                        </td>
                        <td className="py-2.5 text-[#94A3B8]">{formatDate(f.date)}</td>
                        <td className="py-2.5 text-[#94A3B8]">{formatDate(f.due_date)}</td>
                        <td className="py-2.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.cls)}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-[#CBD5E1]">{formatDt(f.total_dt)}</td>
                        <td className="py-2.5 text-right font-medium text-emerald-400">
                          {f.paid_dt > 0 ? formatDt(f.paid_dt) : "—"}
                        </td>
                        <td className="py-2.5 text-right font-semibold">
                          {f.balance_dt > 0.01
                            ? <span className={f.computed_status === "overdue" ? "text-red-400" : "text-amber-400"}>{formatDt(f.balance_dt)}</span>
                            : <span className="text-emerald-400">{tf.facturesSettled}</span>}
                        </td>
                        <td className="py-2.5 pl-2">
                          <Link href={`/dashboard/factures/${f.id}`} className="rounded p-1 text-[#94A3B8] hover:text-brand text-xs">→</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#22506F]">
                    <td colSpan={5} className="pt-2.5 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{tf.facturesTotal}</td>
                    <td className="pt-2.5 text-right font-bold text-[#F8FAFC]">{formatDt(filtered.reduce((s, f) => s + f.total_dt, 0))}</td>
                    <td className="pt-2.5 text-right font-bold text-emerald-400">{formatDt(filtered.reduce((s, f) => s + f.paid_dt, 0))}</td>
                    <td className="pt-2.5 text-right font-bold text-red-400">{formatDt(filtered.reduce((s, f) => s + Math.max(0, f.balance_dt), 0))}</td>
                    <td></td>
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

function FactureStat({ label, value, color = "text-[#F8FAFC]" }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-[#22506F] bg-[#0D2D47] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">{label}</p>
      <p className={cn("mt-2 text-xl font-bold", color)}>{formatDt(value)}</p>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-brand text-white" : "bg-[#1A3E5C] text-[#94A3B8] hover:bg-[#22506F]",
      )}
    >
      {children}
    </button>
  );
}
