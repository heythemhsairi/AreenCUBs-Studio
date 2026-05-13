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
import { WorkCalendar } from "@/components/work-calendar";
import { formatDevisNumber, formatDt, formatDate } from "@/lib/format";
import type { UserRole } from "@/lib/utils";

type Counts = {
  activeProjects: number;
  activeTasks: number;
  teamSize: number | null;
  clients: number | null;
  myActiveTasks: number;
  myOverdueTasks: number;
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
  status: string;
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
  workSchedule: Record<string, "office" | "home">;
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
  workSchedule,
}: Props) {
  const { t } = useI18n();
  const isAdmin = role === "admin";

  const subtitle =
    role === "admin"
      ? t.dashboard.admin.title
      : role === "worker"
        ? t.dashboard.worker.title
        : t.dashboard.freelancer.title;

  return (
    <div className="space-y-7">
      <Greeting fullName={fullName} subtitle={subtitle} role={role} />

      {isAdmin && (
        <section className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-4">
          <HeroRevenueCard
            mtdPaid={revenue.mtdPaid}
            mtdInvoiced={revenue.mtdInvoiced}
            paidTrend={revenue.paidTrend}
          />

          <KpiCard
            label={t.kpis.invoicedMonth}
            value={revenue.mtdInvoiced}
            currency
            trend={revenue.invoicedTrend}
            tone="brand"
            trendSuffix={t.kpis.vsLastMonth}
            icon={
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M9 13h6 M9 17h6" />
            }
          />
          <KpiCard
            label={t.kpis.outstanding}
            value={revenue.outstanding}
            currency
            trend={revenue.outstandingTrend}
            invertTrend
            tone="amber"
            trendSuffix={t.kpis.vsLastMonth}
            icon={
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </>
            }
          />
          <KpiCard
            label={t.kpis.activeProjects}
            value={counts.activeProjects}
            tone="ink"
            icon={
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            }
          />
        </section>
      )}

      {!isAdmin && (
        <>
          <section className="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-4">
            <KpiCard
              label={t.kpis.myActiveTasks}
              value={counts.myActiveTasks}
              tone="brand"
              icon={<path d="M3 6h2l1 2h13M3 12h18M3 18h18" />}
            />
            <KpiCard
              label={t.kpis.overdue}
              value={counts.myOverdueTasks}
              tone={counts.myOverdueTasks > 0 ? "amber" : "ink"}
              icon={
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </>
              }
            />
            <KpiCard
              label={t.kpis.activeProjects}
              value={counts.activeProjects}
              tone="ink"
              icon={
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              }
            />
            {counts.clients !== null && (
              <KpiCard
                label={t.kpis.clients}
                value={counts.clients}
                icon={
                  <>
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  </>
                }
              />
            )}
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Mes tâches</CardTitle>
                  <Link
                    href="/dashboard/tasks"
                    className="text-xs font-semibold text-brand hover:text-brand-dark"
                  >
                    Tout voir →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <MyTasksList rows={upcomingTasks} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Mon planning</CardTitle>
                <p className="text-xs text-ink/55">
                  Bureau 🏢 ou Maison 🏠 — pour la coordination équipe
                </p>
              </CardHeader>
              <CardContent>
                <WorkCalendar initial={workSchedule} />
              </CardContent>
            </Card>
          </section>
        </>
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

      {isAdmin && (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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

          <Card>
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
      )}
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
  const { t } = useI18n();
  const collectionRate =
    mtdInvoiced > 0 ? Math.min(100, (mtdPaid / mtdInvoiced) * 100) : 0;

  return (
    <Card className="relative h-full overflow-hidden border-0 bg-gradient-to-br from-brand via-brand-dark to-ink p-0 shadow-brand-glow lg:col-span-1 surface-grain">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-brand/40 blur-3xl" />

      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cream/70">
            {t.kpis.revenueMtd}
          </p>
          <TrendPill pct={paidTrend} className="!bg-white/15 !text-white !ring-0" />
        </div>

        <p className="mt-3 text-3xl font-semibold tracking-tight text-cream md:text-[34px]">
          <CountUp to={mtdPaid} decimals={0} suffix=" DT" />
        </p>
        <p className="mt-1 text-xs text-cream/60">
          {t.kpis.sumInvoiced(formatDt(mtdInvoiced))}
        </p>

        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-cream/80">
            <span>{t.kpis.collectionRate}</span>
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
  trendSuffix,
}: {
  label: string;
  value: number;
  trend?: number | null;
  invertTrend?: boolean;
  currency?: boolean;
  tone?: "brand" | "amber" | "ink" | "neutral";
  icon?: React.ReactNode;
  trendSuffix?: string;
}) {
  // Tone drives the icon chip color + a subtle bottom-right glow on the
  // card body — replaces the old top ribbon (which crashed visually into
  // the label text on the screenshot Heythem flagged).
  const iconClass =
    tone === "brand"
      ? "bg-brand/12 text-brand"
      : tone === "amber"
        ? "bg-accent/18 text-accent-dark"
        : tone === "ink"
          ? "bg-ink/10 text-ink"
          : "bg-ink/5 text-ink/60";

  const glowClass =
    tone === "brand"
      ? "bg-brand/12"
      : tone === "amber"
        ? "bg-accent/15"
        : tone === "ink"
          ? "bg-ink/8"
          : "bg-ink/4";

  return (
    <Card
      interactive
      className="relative h-full overflow-hidden border border-ink/8 dark:border-white/8"
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full blur-2xl ${glowClass}`}
      />
      <CardContent className="relative flex h-full flex-col p-5">
        {/* Top row: label + icon chip */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/55">
            {label}
          </p>
          {icon && (
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icon}
              </svg>
            </span>
          )}
        </div>

        {/* Value block — vertically centered in the remaining space so the
            big number sits on the same baseline across all four cards. */}
        <div className="flex flex-1 flex-col justify-center pt-4">
          <p className="font-mono text-[30px] font-semibold leading-none tracking-tight text-ink">
            <CountUp
              to={value}
              decimals={0}
              suffix={currency ? " DT" : ""}
            />
          </p>
          <div className="mt-2.5 flex min-h-[18px] items-center gap-2">
            {trend !== undefined ? (
              <>
                <TrendPill pct={trend} invert={invertTrend} />
                {trendSuffix && (
                  <span className="text-[11px] text-ink/45">
                    {trendSuffix}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-ink/30">
                {/* invisible placeholder keeps the baseline consistent */}
                &nbsp;
              </span>
            )}
          </div>
        </div>
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
  const name = featured.full_name ?? featured.username;
  return (
    <Card
      variant="accent"
      interactive
      className="featured-card relative overflow-hidden border-accent/40 dark:border-accent/30"
    >
      <CardContent className="relative flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:items-stretch sm:text-left">
        {/* Avatar with triple-layer halo */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 -m-2 animate-pulse rounded-full bg-gradient-to-br from-accent via-accent-dark to-brand opacity-50 blur-lg dark:opacity-70" />
          <div className="absolute inset-0 -m-0.5 rounded-full bg-gradient-to-br from-accent to-brand p-[2px]">
            <div className="h-full w-full rounded-full bg-cream dark:bg-[#13151c]" />
          </div>
          <Avatar
            src={featured.avatar_url}
            name={name}
            size="xl"
            className="relative ring-2 ring-accent ring-offset-2 ring-offset-cream dark:ring-offset-[#13151c]"
          />
          <span
            className="absolute -top-3 left-1/2 -translate-x-1/2 -rotate-12 text-2xl drop-shadow-md"
            aria-hidden
          >
            👑
          </span>
        </div>

        <div className="flex-1 sm:py-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-dark ring-1 ring-accent/40 dark:bg-accent/30 dark:text-[#ffd9a3] dark:ring-accent/60">
              ⭐ Employé du mois
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45 dark:text-cream/65">
              {formatMonth(featured.month)}
            </span>
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-[26px]">
            <span className="bg-gradient-to-r from-accent-dark via-accent to-brand bg-clip-text text-transparent dark:from-[#ffb84d] dark:via-[#ffd9a3] dark:to-[#a0d2eb]">
              {name}
            </span>
          </h3>
          {featured.reason && (
            <p className="mt-1.5 text-sm italic leading-relaxed text-ink/75 dark:text-cream/90">
              « {featured.reason} »
            </p>
          )}
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-start">
            <Link
              href="/dashboard/team/featured"
              className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-white/70 px-3 py-1 text-xs font-semibold text-accent-dark backdrop-blur transition-all hover:bg-accent hover:text-white hover:shadow-accent-glow dark:border-accent/50 dark:bg-accent/15 dark:text-[#ffd9a3] dark:hover:bg-accent dark:hover:text-ink"
            >
              Modifier →
            </Link>
          </div>
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

const myStatusTone: Record<string, "slate" | "blue" | "amber" | "green"> = {
  todo: "slate",
  in_progress: "blue",
  review: "amber",
  done: "green",
};

const myStatusLabel: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  review: "À valider",
  done: "Terminé",
  cancelled: "Annulé",
};

function MyTasksList({ rows }: { rows: UpcomingTask[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-ink/45">
          🎉 Aucune tâche en attente. Profitez-en !
        </p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <ul className="space-y-1.5">
      {rows.map((t) => {
        const due = new Date(t.deadline);
        const days = Math.floor(
          (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        const isOverdue = days < 0;
        const isToday = days === 0;
        const isSoon = days > 0 && days <= 3;

        return (
          <li key={t.id}>
            <Link
              href={`/dashboard/tasks/${t.id}`}
              className="group block rounded-xl border border-white/40 bg-white/60 p-3 transition-all hover:bg-white hover:shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink group-hover:text-brand">
                    {t.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink/50">
                    {t.client} · {t.project}
                  </p>
                </div>
                <Badge
                  tone={myStatusTone[t.status] ?? "slate"}
                  dot={t.status === "in_progress" ? "pulse" : true}
                >
                  {myStatusLabel[t.status] ?? t.status}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
                <span
                  className={`rounded-md px-2 py-0.5 font-semibold ${
                    isOverdue
                      ? "bg-red-50 text-red-700"
                      : isToday
                        ? "bg-accent/20 text-accent-dark"
                        : isSoon
                          ? "bg-accent/10 text-accent-dark"
                          : "bg-ink/5 text-ink/55"
                  }`}
                >
                  {isOverdue
                    ? `${Math.abs(days)}j de retard`
                    : isToday
                      ? "Aujourd'hui"
                      : `Échéance dans ${days}j`}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
