"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import type { UserRole } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { formatDt } from "@/lib/format";

type Counts = {
  activeProjects: number;
  activeTasks: number;
  teamSize: number | null;
  clients: number | null;
  outstandingDt: number | null;
};

type Featured = {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  reason: string | null;
  month: string;
} | null;

type Props = {
  role: UserRole;
  fullName: string;
  counts: Counts;
  featuredEmployee: Featured;
};

function formatMonth(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

export function OverviewClient({
  role,
  fullName,
  counts,
  featuredEmployee,
}: Props) {
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
      <div className="rounded-2xl bg-brand-gradient p-[1px] shadow-brand-glow">
        <div className="rounded-[15px] bg-gradient-to-br from-cream via-cream to-cream-dark px-6 py-6">
          <p className="text-xs uppercase tracking-[0.18em] text-brand-dark/80">
            {t.dashboard.welcome}, {fullName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink md:text-3xl">
            {title}
          </h1>
        </div>
      </div>

      {featuredEmployee && (
        <Card className="overflow-hidden border-accent/40 bg-gradient-to-br from-accent/15 via-cream to-cream">
          <CardContent className="flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:text-left">
            <Avatar
              src={featuredEmployee.avatar_url}
              name={
                featuredEmployee.full_name ?? featuredEmployee.username
              }
              size="lg"
              className="ring-2 ring-accent ring-offset-2 ring-offset-cream"
            />
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-dark">
                ⭐ Employé du mois · {formatMonth(featuredEmployee.month)}
              </p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {featuredEmployee.full_name ?? featuredEmployee.username}
              </p>
              {featuredEmployee.reason && (
                <p className="mt-0.5 text-sm text-ink/70">
                  {featuredEmployee.reason}
                </p>
              )}
            </div>
            {role === "admin" && (
              <Link
                href="/dashboard/team/featured"
                className="text-xs font-medium text-accent-dark hover:text-ink"
              >
                Modifier →
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {role === "admin" && !featuredEmployee && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-semibold text-ink">
                Pas encore d&apos;employé du mois
              </p>
              <p className="text-xs text-ink/50">
                Reconnaissez le travail d&apos;un membre.
              </p>
            </div>
            <Link
              href="/dashboard/team/featured"
              className="text-sm font-medium text-brand hover:text-brand-dark"
            >
              ⭐ Désigner →
            </Link>
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {role === "admin" && (
          <KpiCard
            label={kpis.outstanding}
            value={
              counts.outstandingDt === null
                ? "—"
                : formatDt(counts.outstandingDt)
            }
            tone="amber"
          />
        )}
        <KpiCard
          label={kpis.activeProjects}
          value={counts.activeProjects}
          tone="brand"
        />
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

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "brand" | "amber" | "neutral";
}) {
  const accent =
    tone === "brand"
      ? "before:bg-brand"
      : tone === "amber"
        ? "before:bg-accent"
        : "before:bg-ink/30";
  return (
    <Card
      className={`relative overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 ${accent}`}
    >
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-ink/50">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      </CardContent>
    </Card>
  );
}
