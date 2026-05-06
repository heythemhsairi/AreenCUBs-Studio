"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import type { UserRole } from "@/lib/utils";
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
    <div className="space-y-8">
      <Hero title={title} fullName={fullName} role={role} />

      {featuredEmployee && (
        <FeaturedCard featured={featuredEmployee} canEdit={role === "admin"} />
      )}

      {role === "admin" && !featuredEmployee && <FeaturedEmptyCta />}

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
            icon={
              <path d="M12 2v20m9-9H3" />
            }
          />
        )}
        <KpiCard
          label={kpis.activeProjects}
          value={counts.activeProjects}
          tone="brand"
          icon={
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          }
        />
        <KpiCard
          label={kpis.activeTasks}
          value={counts.activeTasks}
          icon={
            <path d="M3 6h2l1 2h13M3 12h18M3 18h18" />
          }
        />
        {counts.clients !== null && (
          <KpiCard
            label={kpis.clients}
            value={counts.clients}
            icon={
              <>
                <circle cx="9" cy="8" r="3.5" />
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              </>
            }
          />
        )}
        {counts.teamSize !== null && (
          <KpiCard
            label={kpis.teamSize}
            value={counts.teamSize}
            tone="ink"
            icon={
              <>
                <circle cx="9" cy="8" r="3.5" />
                <circle cx="17" cy="9" r="2.5" />
                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              </>
            }
          />
        )}
      </section>
    </div>
  );
}

function Hero({
  title,
  fullName,
  role,
}: {
  title: string;
  fullName: string;
  role: UserRole;
}) {
  return (
    <section className="reveal relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-[#13131a] to-ink p-7 shadow-lift surface-grain">
      <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
          {role === "admin"
            ? "Admin"
            : role === "worker"
              ? "Équipe"
              : "Freelance"}{" "}
          · Areen CUBs
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-cream md:text-4xl">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-cream/70">
          Bienvenue, <span className="text-cream">{fullName}</span>.
        </p>
      </div>
    </section>
  );
}

function FeaturedCard({
  featured,
  canEdit,
}: {
  featured: NonNullable<Featured>;
  canEdit: boolean;
}) {
  return (
    <Card
      bordered="accent"
      className="overflow-hidden bg-gradient-to-br from-accent/10 via-cream to-cream"
      interactive
    >
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
        <div className="relative">
          <div className="absolute inset-0 -m-1 animate-pulse rounded-full bg-accent/30 blur-md" />
          <Avatar
            src={featured.avatar_url}
            name={featured.full_name ?? featured.username}
            size="lg"
            className="relative ring-2 ring-accent ring-offset-2 ring-offset-cream"
          />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-dark">
            ⭐ Employé du mois · {formatMonth(featured.month)}
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-ink">
            {featured.full_name ?? featured.username}
          </p>
          {featured.reason && (
            <p className="mt-1 text-sm leading-relaxed text-ink/70">
              « {featured.reason} »
            </p>
          )}
        </div>
        {canEdit && (
          <Link
            href="/dashboard/team/featured"
            className="text-xs font-semibold text-accent-dark hover:text-ink"
          >
            Modifier →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function FeaturedEmptyCta() {
  return (
    <Card className="border-dashed bg-cream/40">
      <CardContent className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-lg">
            ⭐
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">
              Pas encore d&apos;employé du mois
            </p>
            <p className="text-xs text-ink/55">
              Reconnaissez le travail d&apos;un membre de l&apos;équipe.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/team/featured"
          className="text-sm font-semibold text-brand hover:text-brand-dark"
        >
          Désigner →
        </Link>
      </CardContent>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: number | string;
  tone?: "brand" | "amber" | "ink" | "neutral";
  icon?: React.ReactNode;
}) {
  const accent =
    tone === "brand"
      ? "bg-brand/10 text-brand"
      : tone === "amber"
        ? "bg-accent/15 text-accent-dark"
        : tone === "ink"
          ? "bg-ink/10 text-ink"
          : "bg-ink/5 text-ink/60";

  const ribbon =
    tone === "brand"
      ? "bg-brand"
      : tone === "amber"
        ? "bg-accent"
        : tone === "ink"
          ? "bg-ink"
          : "bg-ink/30";

  return (
    <Card
      interactive
      className="relative overflow-hidden"
    >
      <div className={`absolute inset-x-0 top-0 h-0.5 ${ribbon}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">
            {label}
          </p>
          {icon && (
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icon}
              </svg>
            </span>
          )}
        </div>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
