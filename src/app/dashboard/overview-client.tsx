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

function formatMonth(
  monthIso: string,
  months: readonly string[],
): string {
  const [y, m] = monthIso.split("-").map(Number);
  const monthName = months[(m ?? 1) - 1] ?? "";
  return `${monthName} ${y}`;
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
                  <CardTitle>{t.overview.myTasks}</CardTitle>
                  <Link
                    href="/dashboard/tasks"
                    className="text-xs font-semibold text-brand hover:text-brand-dark"
                  >
                    {t.overview.seeAll}
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <MyTasksList rows={upcomingTasks} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t.overview.myPlanning}</CardTitle>
                <p className="text-xs text-ink/55">
                  {t.overview.myPlanningHint}
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
                <CardTitle>{t.overview.revenue12}</CardTitle>
                <Link
                  href="/dashboard/finance"
                  className="text-xs font-semibold text-brand hover:text-brand-dark"
                >
                  {t.overview.financeDetails}
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <MonthlyBars series={monthlySeries} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.overview.serviceMix}</CardTitle>
              <p className="text-xs text-ink/50">
                {t.overview.serviceMixHint}
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
                  {t.overview.noServiceMix}
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
                <CardTitle>{t.overview.recentActivity}</CardTitle>
                <Link
                  href="/dashboard/devis"
                  className="text-xs font-semibold text-brand hover:text-brand-dark"
                >
                  {t.overview.seeAll}
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
                <CardTitle>{t.overview.upcoming}</CardTitle>
                <Link
                  href="/dashboard/tasks"
                  className="text-xs font-semibold text-brand hover:text-brand-dark"
                >
                  {t.overview.seeAll}
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
  const { t } = useI18n();
  const hour = new Date().getHours();
  const time =
    hour < 5
      ? t.greeting.goodNight
      : hour < 12
        ? t.greeting.goodMorning
        : hour < 18
          ? t.greeting.goodAfternoon
          : t.greeting.goodEvening;

  return (
    <section className="reveal flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
        {role === "admin"
          ? t.greeting.spaceAdmin
          : role === "worker"
            ? t.greeting.spaceTeam
            : t.greeting.spaceFreelance}
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
    <Card className="relative h-full overflow-hidden border-0 bg-gradient-to-br from-brand via-brand-dark to-[#0a1326] p-0 shadow-brand-glow lg:col-span-1 surface-grain">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[#7c4dff]/30 blur-3xl" />

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
              className="h-full bg-gradient-to-r from-cyan-300 via-[#a0d2eb] to-white transition-all duration-700"
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
  scaleMax,
}: {
  label: string;
  value: number;
  trend?: number | null;
  invertTrend?: boolean;
  currency?: boolean;
  tone?: "brand" | "amber" | "ink" | "neutral";
  icon?: React.ReactNode;
  trendSuffix?: string;
  /** Optional value reference for the progress bar (0..scaleMax). */
  scaleMax?: number;
}) {
  // Tone-driven palette. Orange/amber stays available for legacy callers but
  // we route admin "outstanding" → amber, everything else → brand/ink/violet.
  const iconClass =
    tone === "brand"
      ? "bg-brand/15 text-brand"
      : tone === "amber"
        ? "bg-[#7c4dff]/18 text-[#bfa6ff]"
        : tone === "ink"
          ? "bg-ink/10 text-ink"
          : "bg-ink/5 text-ink/60";

  const glowClass =
    tone === "brand"
      ? "bg-brand/15"
      : tone === "amber"
        ? "bg-[#7c4dff]/18"
        : tone === "ink"
          ? "bg-cyan-400/10"
          : "bg-ink/4";

  const barClass =
    tone === "brand"
      ? "from-brand to-cyan-400"
      : tone === "amber"
        ? "from-[#7c4dff] to-[#a78bfa]"
        : tone === "ink"
          ? "from-ink to-ink-soft"
          : "from-ink/30 to-ink/15";

  // Progress bar width (0..100%). If no scaleMax given, fall back to a fixed
  // reference so the bar still visualizes activity without being misleading.
  const pct =
    scaleMax && scaleMax > 0
      ? Math.max(0, Math.min(100, (value / scaleMax) * 100))
      : value === 0
        ? 0
        : Math.min(100, 18 + Math.log10(Math.max(value, 1)) * 28);

  return (
    <Card
      interactive
      className="relative h-full overflow-hidden border-0 p-0"
    >
      {/*
        Solid layered card surface — fixes the "label floats outside the
        card" perception from Heythem's screenshot. The previous
        bg-white/8 was so transparent that labels read as sitting on the
        page background instead of inside a card.
      */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#161f3a] via-[#121a2e] to-[#0d1424] ring-1 ring-inset ring-white/10"
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute -bottom-14 -right-14 h-40 w-40 rounded-full blur-3xl ${glowClass}`}
      />
      <CardContent className="relative flex h-full flex-col px-5 py-5 md:px-6 md:py-6">
        {/* Top row: label + icon chip */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/60">
            {label}
          </p>
          {icon && (
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10 ${iconClass}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icon}
              </svg>
            </span>
          )}
        </div>

        {/* Value + scale bar — centered in the remaining space so all four
            cards share the same value baseline. */}
        <div className="flex flex-1 flex-col justify-center pt-5">
          <p className="font-mono text-[32px] font-semibold leading-none tracking-tight text-cream">
            <CountUp
              to={value}
              decimals={0}
              suffix={currency ? " DT" : ""}
            />
          </p>
          {/* Slim relative-scale bar so the card never reads "empty". */}
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/8">
            <div
              className={`h-full bg-gradient-to-r ${barClass} transition-all duration-700`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2.5 flex min-h-[18px] items-center gap-2">
            {trend !== undefined ? (
              <>
                <TrendPill pct={trend} invert={invertTrend} />
                {trendSuffix && (
                  <span className="text-[11px] text-cream/50">
                    {trendSuffix}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-cream/30">
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
  const { t } = useI18n();
  return (
    <Card
      interactive
      className="relative overflow-hidden border-0 p-0"
    >
      {/* Deep navy backdrop with floating brand/violet/cyan blobs */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1a2a4a] via-[#0f1830] to-[#0a1326] ring-1 ring-inset ring-white/12"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-[#7c4dff]/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 top-1/3 h-48 w-48 rounded-full bg-cyan-400/22 blur-3xl"
      />

      <CardContent className="relative flex min-h-[140px] flex-col items-center gap-6 px-8 py-8 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
        {/* Avatar with electric halo */}
        <div className="relative shrink-0">
          <div
            aria-hidden
            className="absolute inset-0 -m-2.5 animate-pulse rounded-full bg-gradient-to-br from-brand via-[#7c4dff] to-cyan-400 opacity-70 blur-xl"
          />
          <div className="absolute inset-0 -m-1 rounded-full bg-gradient-to-br from-brand via-[#7c4dff] to-cyan-400 p-[2px]">
            <div className="h-full w-full rounded-full bg-[#0a1326]" />
          </div>
          <Avatar
            src={featured.avatar_url}
            name={name}
            size="xl"
            className="relative ring-2 ring-brand/70 ring-offset-2 ring-offset-[#0a1326]"
          />
          <span
            className="absolute -top-3 left-1/2 -translate-x-1/2 -rotate-12 text-2xl drop-shadow-md"
            aria-hidden
          >
            ⭐
          </span>
        </div>

        {/*
          Robust text column:
          - min-w-0 lets the flex child shrink properly
          - leading-snug + py-1 reserves room for descenders on every glyph
          - solid white name (text-white) — no bg-clip-text trickery so
            nothing gets cropped by the gradient mask
          - tracking-[-0.01em] for a confident SaaS-grade title
        */}
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-300/15 px-3 py-1 text-[10.5px] font-bold uppercase leading-none tracking-[0.20em] text-cyan-100 ring-1 ring-cyan-300/40">
              ✦ {t.featured.title}
            </span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-cream/55">
              {formatMonth(featured.month, t.overview.months)}
            </span>
          </div>
          <h3 className="text-[28px] font-semibold leading-snug tracking-[-0.01em] text-white md:text-[32px]">
            {name}
          </h3>
          {featured.reason && (
            <p className="text-sm italic leading-relaxed text-cream/75">
              « {featured.reason} »
            </p>
          )}
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center">
            <Link
              href="/dashboard/team/featured"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-cream/95 backdrop-blur transition-all hover:border-brand/60 hover:bg-brand/30 hover:text-white"
            >
              {t.featured.edit}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeaturedEmptyCta() {
  const { t } = useI18n();
  return (
    <Card className="border-dashed border-brand/30 bg-brand/5 dark:border-white/10 dark:bg-white/3">
      <CardContent className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/12 text-lg text-brand">
            ✦
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">
              {t.featured.empty}
            </p>
            <p className="text-xs text-ink/55">{t.featured.emptyHint}</p>
          </div>
        </div>
        <Link
          href="/dashboard/team/featured"
          className="text-sm font-semibold text-brand hover:text-brand-dark"
        >
          {t.featured.designate}
        </Link>
      </CardContent>
    </Card>
  );
}

function RecentDevisFeed({ rows }: { rows: RecentDevis[] }) {
  const { t } = useI18n();
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink/45">
        {t.overview.noRecent}
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {rows.map((d) => {
        const baseUrl =
          d.kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";
        const statusKey = d.status as keyof typeof t.devis.status;
        const statusText = t.devis.status[statusKey] ?? d.status;
        return (
          <li key={d.id}>
            <Link
              href={`${baseUrl}/${d.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/8"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  d.kind === "facture"
                    ? "bg-[#7c4dff]/20 text-[#bfa6ff]"
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
                <Badge tone={statusTone[d.status]}>{statusText}</Badge>
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
  const { t } = useI18n();
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink/45">
        {t.overview.noUpcoming}
      </p>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <ul className="space-y-1">
      {rows.map((task) => {
        const due = new Date(task.deadline);
        const days = Math.floor(
          (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        const isOverdue = days < 0;
        const isSoon = days >= 0 && days <= 3;
        const priKey = task.priority as keyof typeof t.tasks.priority;
        const priorityText = t.tasks.priority[priKey] ?? task.priority;

        return (
          <li key={task.id}>
            <Link
              href={`/dashboard/tasks/${task.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/8"
            >
              {task.assignee ? (
                <Avatar
                  src={task.assignee.avatar}
                  name={task.assignee.name}
                  size="sm"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/10 text-xs text-ink/40">
                  ?
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {task.title}
                </p>
                <p className="truncate text-xs text-ink/50">
                  {task.client} · {task.project}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={priorityTone[task.priority]}>
                  {priorityText}
                </Badge>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    isOverdue
                      ? "bg-red-500/15 text-red-300"
                      : isSoon
                        ? "bg-brand/15 text-brand"
                        : "bg-white/8 text-ink/55"
                  }`}
                >
                  {isOverdue
                    ? t.overview.relativeOverdue(days)
                    : days === 0
                      ? t.overview.relativeTodayShort
                      : t.overview.relativeIn(days)}
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

function MyTasksList({ rows }: { rows: UpcomingTask[] }) {
  const { t } = useI18n();
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-ink/45">{t.overview.noMine}</p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <ul className="space-y-1.5">
      {rows.map((task) => {
        const due = new Date(task.deadline);
        const days = Math.floor(
          (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        const isOverdue = days < 0;
        const isToday = days === 0;
        const isSoon = days > 0 && days <= 3;
        const statusKey = task.status as keyof typeof t.tasks.status;
        const statusText = t.tasks.status[statusKey] ?? task.status;
        const priKey = task.priority as keyof typeof t.tasks.priority;
        const priorityText = t.tasks.priority[priKey] ?? task.priority;

        return (
          <li key={task.id}>
            <Link
              href={`/dashboard/tasks/${task.id}`}
              className="group block rounded-xl border border-white/15 bg-white/8 p-3 transition-all hover:border-brand/30 hover:bg-white/12 hover:shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink group-hover:text-brand">
                    {task.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink/50">
                    {task.client} · {task.project}
                  </p>
                </div>
                <Badge
                  tone={myStatusTone[task.status] ?? "slate"}
                  dot={task.status === "in_progress" ? "pulse" : true}
                >
                  {statusText}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <Badge tone={priorityTone[task.priority]}>
                  {priorityText}
                </Badge>
                <span
                  className={`rounded-md px-2 py-0.5 font-semibold ${
                    isOverdue
                      ? "bg-red-500/15 text-red-300"
                      : isToday
                        ? "bg-brand/20 text-brand"
                        : isSoon
                          ? "bg-brand/12 text-brand"
                          : "bg-white/8 text-ink/55"
                  }`}
                >
                  {isOverdue
                    ? t.overview.relativeOverdueLong(days)
                    : isToday
                      ? t.overview.relativeTodayLong
                      : t.overview.relativeInLong(days)}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
