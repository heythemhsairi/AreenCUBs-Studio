"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { ChevronLeft, BarChart2, CheckCircle2, Clock, Layers, ExternalLink, Share2 } from "lucide-react";

type ContentItem = {
  id: string;
  status: string;
  content_type: string;
  platform: string;
  approval_status: string | null;
  publish_date: string | null;
};
type Plan = {
  id: string;
  client_id: string;
  month: number;
  year: number;
  theme: string | null;
  status: string;
  approved_at: string | null;
  clients: { id: string; name: string } | null;
  content_items: ContentItem[];
};

type SocialStats = {
  total: number;
  scheduled: number;
  published: number;
  draft: number;
};

type Props = { plans: Plan[]; socialStats?: SocialStats };

const STATUS_BG: Record<string, string> = {
  draft: "bg-[var(--c-border)] text-[var(--c-text-3)]",
  approved: "bg-emerald-500/15 text-emerald-400",
  archived: "bg-[var(--c-border)] text-[var(--c-text-3)]",
};

export function ContentReportsClient({ plans, socialStats }: Props) {
  const { t } = useI18n();
  const c = t.contentOS;
  const monthNames = c.months;
  const [clientFilter, setClientFilter] = useState<string>("all");

  const clientMap = new Map<string, string>();
  for (const p of plans) {
    if (p.clients) clientMap.set(p.clients.id, p.clients.name);
  }
  const clientOptions = Array.from(clientMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  const filteredPlans = clientFilter === "all"
    ? plans
    : plans.filter((p) => p.client_id === clientFilter);

  const totalPlans = filteredPlans.length;
  const approvedPlans = filteredPlans.filter((p) => p.status === "approved").length;
  const totalItems = filteredPlans.reduce((s, p) => s + p.content_items.length, 0);
  const publishedItems = filteredPlans.reduce(
    (s, p) => s + p.content_items.filter((i) => i.status === "published").length,
    0,
  );
  const clientApproved = filteredPlans.reduce(
    (s, p) => s + p.content_items.filter((i) => i.approval_status === "approved").length,
    0,
  );

  const platformCounts = new Map<string, number>();
  for (const plan of filteredPlans) {
    for (const item of plan.content_items) {
      platformCounts.set(item.platform, (platformCounts.get(item.platform) ?? 0) + 1);
    }
  }

  const typeCounts = new Map<string, number>();
  for (const plan of filteredPlans) {
    for (const item of plan.content_items) {
      typeCounts.set(item.content_type, (typeCounts.get(item.content_type) ?? 0) + 1);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/content"
            className="flex items-center gap-1 text-sm text-[var(--c-text-3)] hover:text-[var(--c-text-1)] transition-colors"
          >
            <ChevronLeft size={14} />
            {c.title}
          </Link>
          <h1 className="text-xl font-bold text-[var(--c-text-1)]">{c.reportsTitle}</h1>
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text-1)] focus:outline-none focus:border-[#22D3EE]"
        >
          <option value="all">{c.allClients}</option>
          {clientOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      {/* Global KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { icon: Layers, label: c.kpiTotalPlans, value: totalPlans, accent: "#22D3EE" },
          { icon: CheckCircle2, label: c.kpiApprovedPlans, value: approvedPlans, accent: "#22C55E" },
          { icon: BarChart2, label: c.kpiTotalContent, value: totalItems, accent: "#A78BFA" },
          { icon: CheckCircle2, label: c.kpiPublished, value: publishedItems, accent: "#F59E0B" },
          { icon: CheckCircle2, label: c.kpiClientApproved, value: clientApproved, accent: "#EC4899" },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Icon size={13} style={{ color: accent }} />
              <span className="text-xs text-[var(--c-text-3)]">{label}</span>
            </div>
            <span className="text-2xl font-bold text-[var(--c-text-1)]">{value}</span>
          </div>
        ))}
      </div>

      {/* Publishing (social posts) stats */}
      {socialStats && (
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 size={14} className="text-[#22D3EE]" />
              <h3 className="text-sm font-semibold text-[var(--c-text-1)]">
                {c.publishingTitle}
              </h3>
            </div>
            <Link
              href="/dashboard/content/publishing"
              className="text-xs text-[#22D3EE] hover:underline"
            >
              {c.showAll} →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: c.totalPosts, value: socialStats.total, accent: "#22D3EE" },
              { label: c.scheduledPosts, value: socialStats.scheduled, accent: "#22D3EE" },
              { label: c.publishedPosts, value: socialStats.published, accent: "#22C55E" },
              { label: c.draftPosts, value: socialStats.draft, accent: "#64748B" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-[var(--c-elevated)] p-3">
                <p className="text-xs text-[var(--c-text-3)]">{s.label}</p>
                <p className="mt-1 text-xl font-bold" style={{ color: s.accent }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdowns */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* By platform */}
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--c-text-1)]">
            {c.byPlatform}
          </h3>
          {platformCounts.size === 0 ? (
            <p className="text-xs text-[var(--c-text-3)]">—</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from(platformCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([platform, count]) => {
                  const pct = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
                  return (
                    <div key={platform} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-[var(--c-text-2)] capitalize shrink-0">{platform}</span>
                      <div className="flex-1 h-2 rounded-full bg-[var(--c-elevated)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#22D3EE]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs text-[var(--c-text-3)]">{count}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* By content type */}
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--c-text-1)]">
            {c.byContentType}
          </h3>
          {typeCounts.size === 0 ? (
            <p className="text-xs text-[var(--c-text-3)]">—</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from(typeCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => {
                  const pct = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-[var(--c-text-2)] shrink-0">
                        {c.contentType[type as keyof typeof c.contentType] ?? type}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-[var(--c-elevated)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#A78BFA]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs text-[var(--c-text-3)]">{count}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Per-plan table */}
      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)]">
        <div className="border-b border-[var(--c-border)] px-5 py-4">
          <h3 className="text-sm font-semibold text-[var(--c-text-1)]">
            {c.planBreakdown}
          </h3>
        </div>
        {filteredPlans.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--c-text-3)]">
            {c.noPlansFound}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-xs text-[var(--c-text-3)] bg-[var(--c-elevated)]">
                  <th className="px-4 py-3 text-left font-semibold">{c.colClient}</th>
                  <th className="px-4 py-3 text-left font-semibold">{c.colPeriod}</th>
                  <th className="px-4 py-3 text-left font-semibold">{c.colStatus}</th>
                  <th className="px-4 py-3 text-right font-semibold">{c.reportStats.total}</th>
                  <th className="px-4 py-3 text-right font-semibold">{c.reportStats.approved}</th>
                  <th className="px-4 py-3 text-right font-semibold">{c.reportStats.published}</th>
                  <th className="px-4 py-3 text-right font-semibold">{c.colProgress}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border)]">
                {filteredPlans.map((plan) => {
                  const total = plan.content_items.length;
                  const published = plan.content_items.filter((i) => i.status === "published").length;
                  const approved = plan.content_items.filter((i) => i.approval_status === "approved").length;
                  const pct = total > 0 ? Math.round((published / total) * 100) : 0;

                  return (
                    <tr key={plan.id} className="hover:bg-[var(--c-elevated)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--c-text-1)]">
                        {plan.clients?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--c-text-2)]">
                        {monthNames[plan.month - 1]} {plan.year}
                        {plan.theme && <span className="text-[var(--c-text-3)] ml-1">— {plan.theme}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_BG[plan.status] ?? STATUS_BG.draft)}>
                          {c.planStatus[plan.status as keyof typeof c.planStatus] ?? plan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--c-text-2)]">{total}</td>
                      <td className="px-4 py-3 text-right text-[var(--c-text-2)]">{approved}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1 text-emerald-400">
                          <CheckCircle2 size={12} />
                          {published}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[var(--c-elevated)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#22D3EE]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--c-text-3)] w-7 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/content/plans/${plan.id}`}
                          className="flex items-center gap-1 text-[var(--c-text-3)] hover:text-[#22D3EE] transition-colors"
                        >
                          <ExternalLink size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
