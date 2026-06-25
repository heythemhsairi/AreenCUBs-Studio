"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Layers, Users, CalendarDays, BarChart2, ChevronRight, CheckCircle2, Clock, PenTool } from "lucide-react";

type Client = { id: string; name: string; email: string | null };
type ContentItem = { id: string; status: string };
type Plan = {
  id: string;
  client_id: string;
  month: number;
  year: number;
  theme: string | null;
  status: string;
  created_at: string;
  content_items: ContentItem[];
};
type Profile = {
  client_id: string;
  brand_voice: string | null;
  platforms: string[];
  posting_frequency: string | null;
};

type Props = {
  clients: Client[];
  plans: Plan[];
  profiles: Profile[];
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--c-border)] text-[var(--c-text-3)]",
  approved: "bg-emerald-500/15 text-emerald-400",
  archived: "bg-[var(--c-border)] text-[var(--c-text-3)]",
};

export function ContentHubClient({ clients, plans, profiles }: Props) {
  const { t } = useI18n();
  const c = t.contentOS;
  const monthNames = c.months;

  const profileMap = new Map(profiles.map((p) => [p.client_id, p]));
  const plansByClient = new Map<string, Plan[]>();
  for (const plan of plans) {
    const arr = plansByClient.get(plan.client_id) ?? [];
    arr.push(plan);
    plansByClient.set(plan.client_id, arr);
  }

  const totalPlans = plans.length;
  const approvedPlans = plans.filter((p) => p.status === "approved").length;
  const totalItems = plans.reduce((sum, p) => sum + p.content_items.length, 0);
  const publishedItems = plans.reduce(
    (sum, p) => sum + p.content_items.filter((i) => i.status === "published").length,
    0,
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-text-1)]">{c.title}</h1>
          <p className="mt-0.5 text-sm text-[var(--c-text-3)]">{c.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/content/calendar"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-elevated)] transition-colors"
          >
            <CalendarDays size={14} />
            {t.calendar.title}
          </Link>
          <Link
            href="/dashboard/content/reports"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-elevated)] transition-colors"
          >
            <BarChart2 size={14} />
            {c.reportsTitle}
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Layers, label: c.kpiTotalPlans, value: totalPlans, accent: "#22D3EE" },
          { icon: CheckCircle2, label: c.kpiApprovedPlans, value: approvedPlans, accent: "#22C55E" },
          { icon: PenTool, label: c.kpiTotalContent, value: totalItems, accent: "#A78BFA" },
          { icon: CheckCircle2, label: c.kpiPublished, value: publishedItems, accent: "#F59E0B" },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div
            key={label}
            className="flex flex-col gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4"
          >
            <div className="flex items-center gap-2">
              <Icon size={14} style={{ color: accent }} />
              <span className="text-xs text-[var(--c-text-3)]">{label}</span>
            </div>
            <span className="text-2xl font-bold text-[var(--c-text-1)]">{value}</span>
          </div>
        ))}
      </div>

      {/* Clients grid */}
      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-card)] py-16 text-center">
          <Users size={32} className="mx-auto mb-3 text-[var(--c-text-3)]" />
          <p className="text-sm text-[var(--c-text-3)]">{c.noClients}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const profile = profileMap.get(client.id);
            const clientPlans = plansByClient.get(client.id) ?? [];
            const latestPlan = clientPlans[0];
            const itemCount = clientPlans.reduce((s, p) => s + p.content_items.length, 0);
            const publishedCount = clientPlans.reduce(
              (s, p) => s + p.content_items.filter((i) => i.status === "published").length,
              0,
            );

            return (
              <Link
                key={client.id}
                href={`/dashboard/content/clients/${client.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4 transition-all hover:border-[#22D3EE]/40 hover:shadow-md"
              >
                {/* Client name + chevron */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-[var(--c-text-1)] group-hover:text-[#22D3EE] transition-colors">
                      {client.name}
                    </h2>
                    {profile?.posting_frequency && (
                      <p className="text-xs text-[var(--c-text-3)] mt-0.5">
                        {profile.posting_frequency}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-[var(--c-text-3)] group-hover:text-[#22D3EE] transition-colors mt-0.5" />
                </div>

                {/* Profile platforms */}
                {profile?.platforms && profile.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {profile.platforms.slice(0, 4).map((p) => (
                      <span
                        key={p}
                        className="rounded-md bg-[#22D3EE]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#22D3EE]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}

                {/* Latest plan */}
                {latestPlan ? (
                  <div className="flex items-center justify-between rounded-lg bg-[var(--c-elevated)] px-3 py-2 text-xs">
                    <span className="text-[var(--c-text-2)]">
                      {monthNames[latestPlan.month - 1]} {latestPlan.year}
                      {latestPlan.theme ? ` — ${latestPlan.theme}` : ""}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLORS[latestPlan.status] ?? STATUS_COLORS.draft)}>
                      {c.planStatus[latestPlan.status as keyof typeof c.planStatus] ?? latestPlan.status}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--c-text-3)]">{c.noPlans}</p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-[var(--c-text-3)]">
                  <span className="flex items-center gap-1">
                    <Layers size={11} />
                    {c.statsPlans(clientPlans.length)}
                  </span>
                  <span className="flex items-center gap-1">
                    <PenTool size={11} />
                    {c.statsItems(itemCount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {c.statsPublished(publishedCount)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
