"use client";

import { useI18n } from "@/lib/i18n/provider";
import { Card, CardContent } from "@/components/ui/card";
import type { UserRole } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";

type Counts = {
  activeProjects: number;
  activeTasks: number;
  teamSize: number | null;
  clients: number | null;
  outstandingDt: number | null;
};

type Props = {
  role: UserRole;
  fullName: string;
  counts: Counts;
};

export function OverviewClient({ role, fullName, counts }: Props) {
  const { t } = useI18n();
  const title =
    role === "admin"
      ? t.dashboard.admin.title
      : role === "worker"
        ? t.dashboard.worker.title
        : t.dashboard.freelancer.title;

  const kpis = t.dashboard.admin.kpis;

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={`${t.dashboard.welcome}, ${fullName}`} />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {role === "admin" && (
          <KpiCard
            label={kpis.outstanding}
            value={
              counts.outstandingDt === null
                ? "—"
                : `${counts.outstandingDt.toFixed(0)} DT`
            }
          />
        )}
        <KpiCard label={kpis.activeProjects} value={counts.activeProjects} />
        <KpiCard label={kpis.activeTasks} value={counts.activeTasks} />
        {counts.clients !== null && (
          <KpiCard label={kpis.clients} value={counts.clients} />
        )}
        {counts.teamSize !== null && (
          <KpiCard label={kpis.teamSize} value={counts.teamSize} />
        )}
      </section>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}
