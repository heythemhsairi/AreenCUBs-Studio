"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/avatar";
import { CountUp } from "@/components/charts/count-up";
import { TrendPill } from "@/components/charts/trend-pill";
import { Donut, DonutLegend, type DonutSlice } from "@/components/charts/donut";
import { MonthlyBars, type BarPoint } from "@/components/charts/bars";
import { formatDevisNumber, formatDt, formatDate } from "@/lib/format";
import type { UserRole } from "@/lib/utils";

type Counts = {
  activeProjects: number;
  activeTasks: number;
  teamSize: number | null;
  clients: number | null;
};

type Revenue = {
  mtdInvoiced: number;
  mtdPaid: number;
  outstanding: number;
  invoicedTrend: number | null;
  paidTrend: number | null;
  outstandingTrend: number | null;
};

type Featured = {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  reason: string | null;
  month: string;
} | null;

type RecentDevis = {
  id: string;
  kind: "devis" | "facture";
  devis_number: number;
  total_dt: number;
  status: string;
  payment_status: string;
  date: string;
  client_name: string;
};

type UpcomingTask = {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  project: string;
  client: string;
  assignee: { name: string; avatar: string | null } | null;
};

type Props = {
  role: UserRole;
  fullName: string;
  counts: Counts;
  revenue: Revenue;
  monthlySeries: BarPoint[];
  donutData: DonutSlice[];
  recentDevis: RecentDevis[];
  upcomingTasks: UpcomingTask[];
  featuredEmployee: Featured;
};

function formatMonth(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

const statusTone: Record<string, "slate" | "blue" | "green" | "red"> = {
  draft: "slate",
  sent: "blue",
  accepted: "green",
  rejected: "red",
};

const statusLabel: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  unpaid: "Impayé",
  partial: "Partiel",
  paid: "Payé",
};

const priorityTone: Record<string, "slate" | "neutral" | "amber" | "red"> = {
  low: "slate",
  normal: "neutral",
  high: "amber",
  urgent: "red",
};

export function OverviewClient({
  role,
  fullName,
  counts,
  revenue,
  monthlySeries,
  donutData,
  recentDevis,
  upcomingTasks,
  featuredEmployee,
}: Props) {
  const { t } = useI18n();
  const isAdmin = role === "admin";

  const subtitle =
    role === "admin"
      ? "Tableau de bord administrateur"
      : role === "worker"
        ? "Tableau de bord équipe"
        : "Mes tâches assignées";

  return (
    <div className="space-y-7">
      <Greeting fullName={fullName} subtitle={subtitle} role={role} />

      {isAdmin && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <HeroRevenueCard
            mtdPaid={revenue.mtdPaid}
            mtdInvoiced={revenue.mtdInvoiced}
            paidTrend={revenue.paidTrend}
          />

          <KpiCard
            label="Facturé (mois)"
            value={revenue.mtdInvoiced}
            currency
            trend={revenue.invoicedTrend}
            tone="brand"
            icon={
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M9 13h6 M9 17h6" />
            }
          />
          <KpiCard
            label="Impayés"
            value={revenue.outstanding}
            currency
            trend={revenue.outstandingTrend}
            invertTrend
            tone="amber"
            icon={
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </>
            }
          />
          <KpiCard
            label="Projets actifs"
            value={counts.activeProjects}
            tone="ink"
            icon={
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            }
          />
        </section>
      )}

      {!isAdmin && (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Projets actifs"
            value={counts.activeProjects}
            tone="brand"
            icon={
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            }
          />
          <KpiCard
            label="Tâches actives"
            value={counts.activeTasks}
            tone="ink"
            icon={<path d="M3 6h2l1 2h13M3 12h18M3 18h18" />}
          />
          {counts.clients !== null && (
            <KpiCard
              label="Clients"
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
              label="Équipe"
              value={counts.teamSize}
              icon={
                <>
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
                </>
              }
            />
          )}
        </section>
      )}

      {isAdmin && (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Chiffre d&apos;affaires — 12 mois</CardTitle>
                <Link
                  href="/dashboard/finance"
                  className="text-xs font-semibold text-brand hover:text-brand-dark"
                >
                  Détails →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <MonthlyBars series={monthlySeries} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Répartition services</CardTitle>
              <p className="text-xs text-ink/50">
                Devis envoyés &amp; acceptés
              </p>
            </CardHeader>
            <CardContent>
              {donutData.length > 0 ? (
                <div className="space-y-4">
                  <Donut data={donutData} size={180} thickness={20} />
                  <DonutLegend data={donutData.slice(0, 5)} />
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-ink/50">
                  Pas encore de devis envoyés.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {featuredEmployee && (
        <FeaturedCard featured={featuredEmployee} canEdit={isAdmin} />
      )}

      {isAdmin && !featuredEmployee && <FeaturedEmptyCta />}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Activité récente</CardTitle>
                <Link
                  href="/dashboard/devis"
                  className="text-xs font-semibold text-brand hover:text-brand-dark"
                >
                  Tout voir →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <RecentDevisFeed rows={recentDevis} />
            </CardContent>
          </Card>
        )}

        <Card className={isAdmin ? "" : "lg:col-span-2"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Échéances à venir</CardTitle>
              <Link
                href="/dashboard/tasks"
                className="text-xs font-semibold text-brand hover:text-brand-dark"
              >
                Tout voir →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <UpcomingTasksList rows={upcomingTasks} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Greeting({
  fullName,
  subtitle,
  role,
}: {
  fullName: string;
  subtitle: string;
  role: UserRole;
}) {
  const hour = new Date().getHours();
  const time =
    hour < 5 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <section className="reveal flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
        {role === "admin"
          ? "Espace admin"
          : role === "worker"
            ? "Espace équipe"
            : "Espace freelance"}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        {time}, {fullName.split(" ")[0]} 👋
      </h1>
      <p className="text-sm text-ink/55">{subtitle}</p>
    </section>
  );
}

function HeroRevenueCard({
  mtdPaid,
  mtdInvoiced,
  paidTrend,
}: {
  mtdPaid: number;
  mtdInvoiced: number;
  paidTrend: number | null;
}) {
  const collectionRate =
    mtdInvoiced > 0 ? Math.min(100, (mtdPaid / mtdInvoiced) * 100) : 0;

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-brand via-brand-dark to-ink p-0 shadow-brand-glow lg:col-span-1 surface-grain">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-brand/40 blur-3xl" />

      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cream/70">
            Encaissé (mois)
          </p>
          <TrendPill pct={paidTrend} className="!bg-white/15 !text-white !ring-0" />
        </div>

        <p className="mt-3 text-3xl font-semibold tracking-tight text-cream md:text-[34px]">
          <CountUp to={mtdPaid} decimals={0} suffix=" DT" />
        </p>
        <p className="mt-1 text-xs text-cream/60">
          sur {formatDt(mtdInvoiced)} facturés
        </p>

        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-cream/80">
            <span>Taux d&apos;encaissement</span>
            <span>{collectionRate.toFixed(0)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full bg-gradient-to-r from-accent to-cream transition-all duration-700"
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  trend,
  invertTrend,
  currency,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: number;
  trend?: number | null;
  invertTrend?: boolean;
  currency?: boolean;
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
    <Card interactive className="relative overflow-hidden">
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
          <CountUp
            to={value}
            decimals={0}
            suffix={currency ? " DT" : ""}
          />
        </p>
        {trend !== undefined && (
          <div className="mt-1.5 flex items-center gap-2">
            <TrendPill pct={trend} invert={invertTrend} />
            <span className="text-[11px] text-ink/45">vs mois dernier</span>
          </div>
        )}
      </CardContent>
    </Card>
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
      interactive
      className="overflow-hidden bg-gradient-to-br from-accent/12 via-cream to-cream"
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
              Reconnaissez le travail d&apos;un membre.
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

function RecentDevisFeed({ rows }: { rows: RecentDevis[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-ink/45">Rien pour l&apos;instant.</p>;
  }
  return (
    <ul className="space-y-1">
      {rows.map((d) => {
        const baseUrl = d.kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";
        return (
          <li key={d.id}>
            <Link
              href={`${baseUrl}/${d.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-cream/70"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  d.kind === "facture"
                    ? "bg-accent/15 text-accent-dark"
                    : "bg-brand/10 text-brand"
                }`}
              >
                {d.kind === "facture" ? "FA" : "DE"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {d.client_name}
                </p>
                <p className="truncate text-xs text-ink/50">
                  {formatDevisNumber(d.devis_number, d.kind)} ·{" "}
                  {formatDate(d.date)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={statusTone[d.status]}>
                  {statusLabel[d.status] ?? d.status}
                </Badge>
                <span className="text-sm font-semibold text-ink">
                  {formatDt(d.total_dt)}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UpcomingTasksList({ rows }: { rows: UpcomingTask[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink/45">
        Aucune échéance à venir.
      </p>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <ul className="space-y-1">
      {rows.map((t) => {
        const due = new Date(t.deadline);
        const days = Math.floor(
          (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        const isOverdue = days < 0;
        const isSoon = days >= 0 && days <= 3;

        return (
          <li key={t.id}>
            <Link
              href={`/dashboard/tasks/${t.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-cream/70"
            >
              {t.assignee ? (
                <Avatar
                  src={t.assignee.avatar}
                  name={t.assignee.name}
                  size="sm"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/10 text-xs text-ink/40">
                  ?
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {t.title}
                </p>
                <p className="truncate text-xs text-ink/50">
                  {t.client} · {t.project}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    isOverdue
                      ? "bg-red-50 text-red-700"
                      : isSoon
                        ? "bg-accent/15 text-accent-dark"
                        : "bg-ink/5 text-ink/55"
                  }`}
                >
                  {isOverdue
                    ? `${Math.abs(days)}j retard`
                    : days === 0
                      ? "auj."
                      : `J+${days}`}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
