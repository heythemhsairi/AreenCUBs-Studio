"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Users, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { MoneyAmount } from "@/components/ui/money-amount";
import { Avatar } from "@/components/avatar";
import { CountUp } from "@/components/charts/count-up";
import { TrendPill } from "@/components/charts/trend-pill";
import { Donut, DonutLegend, type DonutSlice } from "@/components/charts/donut";
import { MonthlyBars, type BarPoint } from "@/components/charts/bars";
import { WorkCalendar } from "@/components/work-calendar";
import { formatDevisNumber, formatDt, formatDate } from "@/lib/format";
import type { UserRole } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — kept exactly as-is
// ---------------------------------------------------------------------------

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
  paidIsNew?: boolean;
  invoicedIsNew?: boolean;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonth(monthIso: string, months: readonly string[]): string {
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

const priorityTone: Record<string, "slate" | "neutral" | "amber" | "red"> = {
  low: "slate",
  normal: "neutral",
  high: "amber",
  urgent: "red",
};

// Section label style — consistent across the whole file
const SECTION_LABEL =
  "text-[10px] font-semibold uppercase tracking-widest text-[#64748B]";

const SECTION_DIVIDER = "border-[#263244]";

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

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

  // Compute today helpers used by multiple sections
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueTasks = upcomingTasks.filter((task) => {
    const due = new Date(task.deadline);
    return due < today && task.status !== "done";
  });

  const overdueInvoices = recentDevis.filter(
    (d) =>
      d.payment_status === "unpaid" &&
      (d.status === "sent" || d.status === "accepted"),
  );

  const hasPriorities = overdueTasks.length > 0 || overdueInvoices.length > 0;

  // Kanban status distribution
  const statusGroups = {
    todo: upcomingTasks.filter((t) => t.status === "todo").length,
    in_progress: upcomingTasks.filter((t) => t.status === "in_progress").length,
    review: upcomingTasks.filter((t) => t.status === "review").length,
    done: upcomingTasks.filter((t) => t.status === "done").length,
  };
  const totalTasks =
    statusGroups.todo +
    statusGroups.in_progress +
    statusGroups.review +
    statusGroups.done;

  // Net profit: not calculable here without expenses data — show paid amount only

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* GREETING                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Greeting fullName={fullName} subtitle={subtitle} role={role} />

      {/* ================================================================== */}
      {/* 1. TODAY'S PRIORITIES                                               */}
      {/* ================================================================== */}
      {hasPriorities && (
        <section>
          <p className={SECTION_LABEL}>Priorités du jour</p>
          <div className="mt-3 rounded-xl border-l-2 border-[#F43F5E] bg-[#111827] ring-1 ring-[#263244]">
            <div className="flex items-center justify-between border-b border-[#263244] px-5 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#F43F5E]" />
                <span className="text-sm font-semibold text-[#F8FAFC]">
                  Attention requise
                </span>
                {(overdueTasks.length + overdueInvoices.length) > 0 && (
                  <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#F43F5E] px-1.5 text-[10px] font-bold text-white">
                    {overdueTasks.length + overdueInvoices.length}
                  </span>
                )}
              </div>
              <Link
                href="/dashboard/tasks"
                className="text-[11px] font-semibold text-[#38BDF8] hover:text-[#7DD3FC] transition-colors"
              >
                Voir tout →
              </Link>
            </div>

            <div className="divide-y divide-[#1E293B]">
              {overdueTasks.slice(0, 3).map((task) => {
                const due = new Date(task.deadline);
                const daysLate = Math.floor(
                  (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
                );
                return (
                  <Link
                    key={task.id}
                    href={`/dashboard/tasks/${task.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/4"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[#F43F5E]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#F8FAFC]">
                        {task.title}
                      </p>
                      <p className="truncate text-[11px] text-[#64748B]">
                        {task.client} · {task.project}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={task.priority} type="priority" />
                      <span className="rounded-md bg-[#F43F5E]/15 px-2 py-0.5 text-[11px] font-semibold text-[#F43F5E]">
                        {daysLate}j retard
                      </span>
                    </div>
                  </Link>
                );
              })}

              {overdueInvoices.slice(0, 2).map((doc) => (
                <Link
                  key={doc.id}
                  href={`/dashboard/${doc.kind === "facture" ? "factures" : "devis"}/${doc.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/4"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#F8FAFC]">
                      {doc.client_name}
                    </p>
                    <p className="truncate text-[11px] text-[#64748B]">
                      {formatDevisNumber(doc.devis_number, doc.kind)} · {formatDate(doc.date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-md bg-[#F59E0B]/15 px-2 py-0.5 text-[11px] font-semibold text-[#F59E0B]">
                      Impayé
                    </span>
                    <MoneyAmount amount={doc.total_dt} size="sm" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {!hasPriorities && (
        <section>
          <p className={SECTION_LABEL}>Priorités du jour</p>
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/5 px-5 py-4">
            <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
            <p className="text-sm font-medium text-[#22C55E]">
              Tout est sous contrôle — aucune urgence aujourd'hui.
            </p>
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* 2. FINANCE HEALTH (admin only)                                      */}
      {/* ================================================================== */}
      {isAdmin && (
        <section>
          <div className="flex items-center justify-between">
            <p className={SECTION_LABEL}>Santé financière — mois en cours</p>
            <Link
              href="/dashboard/finance"
              className="text-[11px] font-semibold text-[#38BDF8] hover:text-[#7DD3FC] transition-colors"
            >
              Détails →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Hero card — cash encaissé */}
            <HeroRevenueCard
              mtdPaid={revenue.mtdPaid}
              mtdInvoiced={revenue.mtdInvoiced}
              paidTrend={revenue.paidTrend}
              paidIsNew={revenue.paidIsNew}
            />

            {/* Facturé mois */}
            <KpiCard
              label="Facturé (mois)"
              value={revenue.mtdInvoiced}
              suffix=" DT"
              tone="cyan"
              trend={revenue.invoicedTrend}
              trendIsNew={revenue.invoicedIsNew}
              trendLabel={t.kpis.vsLastMonth}
              icon={<FileText className="h-4 w-4" />}
            />

            {/* Impayés */}
            <KpiCard
              label="Impayés"
              value={revenue.outstanding}
              suffix=" DT"
              tone={revenue.outstanding > 0 ? "amber" : "neutral"}
              trend={null}
              icon={<AlertTriangle className="h-4 w-4" />}
              tooltip={
                revenue.outstanding > 0
                  ? "Factures envoyées non réglées"
                  : "Aucun impayé"
              }
            />

            {/* Voir Finance OS */}
            <div className="flex flex-col items-start justify-between rounded-xl bg-[#111827] border border-[#263244] p-5 gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#22D3EE]" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Analyse complète</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[#F8FAFC]">Finance OS</p>
                <p className="mt-0.5 text-xs text-[#64748B]">Dépenses, marges, impayés et audit</p>
              </div>
              <Link
                href="/dashboard/finance"
                className="mt-auto inline-flex items-center gap-1.5 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/25 px-3 py-1.5 text-xs font-semibold text-[#22D3EE] hover:bg-[#22D3EE]/20 transition-colors"
              >
                Voir Finance OS →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Worker/freelancer KPI strip */}
      {!isAdmin && (
        <section>
          <p className={SECTION_LABEL}>Mes indicateurs</p>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label={t.kpis.myActiveTasks}
              value={counts.myActiveTasks}
              tone="cyan"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <KpiCard
              label={t.kpis.overdue}
              value={counts.myOverdueTasks}
              tone={counts.myOverdueTasks > 0 ? "red" : "neutral"}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <KpiCard
              label={t.kpis.activeProjects}
              value={counts.activeProjects}
              tone="violet"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            {counts.clients !== null && (
              <KpiCard
                label={t.kpis.clients}
                value={counts.clients}
                tone="neutral"
                icon={<Users className="h-4 w-4" />}
              />
            )}
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* 3. ACTIVE WORK — kanban status distribution                         */}
      {/* ================================================================== */}
      <section>
        <div className="flex items-center justify-between">
          <p className={SECTION_LABEL}>Travaux en cours</p>
          <Link
            href="/dashboard/tasks"
            className="text-[11px] font-semibold text-[#38BDF8] hover:text-[#7DD3FC] transition-colors"
          >
            Kanban →
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ActiveWorkColumn
            label="À faire"
            count={statusGroups.todo}
            total={totalTasks}
            color="#64748B"
            gradientFrom="from-[#64748B]"
            gradientTo="to-[#94A3B8]"
          />
          <ActiveWorkColumn
            label="En cours"
            count={statusGroups.in_progress}
            total={totalTasks}
            color="#22D3EE"
            gradientFrom="from-[#0891B2]"
            gradientTo="to-[#22D3EE]"
            pulse
          />
          <ActiveWorkColumn
            label="À valider"
            count={statusGroups.review}
            total={totalTasks}
            color="#A78BFA"
            gradientFrom="from-[#7C3AED]"
            gradientTo="to-[#A78BFA]"
          />
          <ActiveWorkColumn
            label="Terminé"
            count={statusGroups.done}
            total={totalTasks}
            color="#22C55E"
            gradientFrom="from-[#15803D]"
            gradientTo="to-[#22C55E]"
          />
        </div>
      </section>

      {/* ================================================================== */}
      {/* 4. UPCOMING DEADLINES                                               */}
      {/* ================================================================== */}
      <section>
        <div className="flex items-center justify-between">
          <p className={SECTION_LABEL}>Prochaines échéances</p>
          <Link
            href="/dashboard/tasks"
            className="text-[11px] font-semibold text-[#38BDF8] hover:text-[#7DD3FC] transition-colors"
          >
            Voir tout →
          </Link>
        </div>
        <div className="mt-3 rounded-xl bg-[#111827] ring-1 ring-[#263244] overflow-hidden">
          <UpcomingDeadlinesList rows={upcomingTasks.slice(0, 5)} today={today} />
        </div>
      </section>

      {/* ================================================================== */}
      {/* 5. RECENT DOCUMENTS                                                 */}
      {/* ================================================================== */}
      <section>
        <div className="flex items-center justify-between">
          <p className={SECTION_LABEL}>Documents récents</p>
          <Link
            href="/dashboard/devis"
            className="text-[11px] font-semibold text-[#38BDF8] hover:text-[#7DD3FC] transition-colors"
          >
            Tout voir →
          </Link>
        </div>
        <div className="mt-3 rounded-xl bg-[#111827] ring-1 ring-[#263244] overflow-hidden">
          <RecentDocsFeed rows={recentDevis} />
        </div>
      </section>

      {/* ================================================================== */}
      {/* REVENUE CHART (admin only)                                          */}
      {/* ================================================================== */}
      {isAdmin && (
        <section>
          <div className="flex items-center justify-between">
            <p className={SECTION_LABEL}>Chiffre d'affaires — 12 mois</p>
            <Link
              href="/dashboard/finance"
              className="text-[11px] font-semibold text-[#38BDF8] hover:text-[#7DD3FC] transition-colors"
            >
              Finances →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-xl bg-[#111827] ring-1 ring-[#263244] p-5">
              <MonthlyBars series={monthlySeries} />
            </div>
            <div className="rounded-xl bg-[#111827] ring-1 ring-[#263244] p-5">
              <p className="mb-4 text-sm font-semibold text-[#F8FAFC]">
                {t.overview.serviceMix}
              </p>
              <p className="mb-4 text-[11px] text-[#64748B]">
                {t.overview.serviceMixHint}
              </p>
              {donutData.length > 0 ? (
                <div className="space-y-4">
                  <Donut data={donutData} size={160} thickness={18} />
                  <DonutLegend data={donutData.slice(0, 5)} />
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-[#64748B]">
                  {t.overview.noServiceMix}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* Worker: My Tasks + Work Calendar                                    */}
      {/* ================================================================== */}
      {!isAdmin && (
        <section>
          <p className={SECTION_LABEL}>Mon espace de travail</p>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-5">
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
                <p className="text-xs text-ink/55">{t.overview.myPlanningHint}</p>
              </CardHeader>
              <CardContent>
                <WorkCalendar initial={workSchedule} />
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* 6. TEAM QUICK-VIEW (admin only)                                     */}
      {/* ================================================================== */}
      {isAdmin && counts.teamSize !== null && counts.teamSize > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <p className={SECTION_LABEL}>Équipe</p>
            <Link
              href="/dashboard/team"
              className="text-[11px] font-semibold text-[#38BDF8] hover:text-[#7DD3FC] transition-colors"
            >
              Gérer →
            </Link>
          </div>
          <div className="mt-3 flex items-center gap-4 rounded-xl bg-[#111827] px-5 py-4 ring-1 ring-[#263244]">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#64748B]" />
              <span className="text-sm font-semibold text-[#F8FAFC]">
                {counts.teamSize} membres
              </span>
            </div>
            <div className="h-4 w-px bg-[#263244]" />
            {counts.activeTasks > 0 && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22D3EE] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22D3EE]" />
                </span>
                <span className="text-sm text-[#94A3B8]">
                  {counts.activeTasks} tâches actives
                </span>
              </div>
            )}
            {counts.activeProjects > 0 && (
              <>
                <div className="h-4 w-px bg-[#263244]" />
                <span className="text-sm text-[#94A3B8]">
                  {counts.activeProjects} projets
                </span>
              </>
            )}
            {counts.clients !== null && counts.clients > 0 && (
              <>
                <div className="h-4 w-px bg-[#263244]" />
                <span className="text-sm text-[#94A3B8]">
                  {counts.clients} clients
                </span>
              </>
            )}
            <div className="ml-auto">
              <Link
                href="/dashboard/planning"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-[#94A3B8] ring-1 ring-[#263244] transition-all hover:bg-white/10 hover:text-[#F8FAFC]"
              >
                <span>Planning équipe</span>
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* FEATURED EMPLOYEE                                                   */}
      {/* ================================================================== */}
      {featuredEmployee && (
        <FeaturedCard featured={featuredEmployee} canEdit={isAdmin} />
      )}

      {isAdmin && !featuredEmployee && <FeaturedEmptyCta />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Greeting
// ---------------------------------------------------------------------------

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
      <h1 className="text-3xl font-semibold tracking-tight text-[#F8FAFC] md:text-4xl">
        {time}, {fullName.split(" ")[0]} 👋
      </h1>
      <p className="text-sm text-[#94A3B8]">{subtitle}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// HeroRevenueCard — kept exactly as before
// ---------------------------------------------------------------------------

function HeroRevenueCard({
  mtdPaid,
  mtdInvoiced,
  paidTrend,
  paidIsNew,
}: {
  mtdPaid: number;
  mtdInvoiced: number;
  paidTrend: number | null;
  paidIsNew?: boolean;
}) {
  const { t } = useI18n();
  const hasInvoiced = mtdInvoiced > 0;
  const collectionRate = hasInvoiced ? (mtdPaid / mtdInvoiced) * 100 : null;
  const barWidth = collectionRate !== null ? Math.min(100, collectionRate) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand via-brand-dark to-[#0a1326] shadow-brand-glow surface-grain">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[#7c4dff]/30 blur-3xl" />

      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cream/70">
            {t.kpis.revenueMtd}
          </p>
          <TrendPill pct={paidTrend} isNew={paidIsNew} className="!bg-white/15 !text-white !ring-0" />
        </div>

        <p className="mt-3 text-3xl font-semibold tracking-tight text-cream md:text-[34px]">
          <CountUp to={mtdPaid} decimals={0} suffix=" DT" />
        </p>
        {hasInvoiced ? (
          <p className="mt-1 text-xs text-cream/60">
            {t.kpis.sumInvoiced(formatDt(mtdInvoiced))}
          </p>
        ) : (
          <p className="mt-1 text-xs text-cream/60">Aucune facture ce mois</p>
        )}

        {collectionRate !== null && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-cream/80">
              <span>{t.kpis.collectionRate}</span>
              <span>
                {collectionRate > 100
                  ? `${collectionRate.toFixed(0)}% ✓`
                  : `${collectionRate.toFixed(0)}%`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full bg-gradient-to-r transition-all duration-700 ${
                  collectionRate >= 100
                    ? "from-emerald-300 via-emerald-200 to-white"
                    : "from-cyan-300 via-[#a0d2eb] to-white"
                }`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveWorkColumn — kanban status column with animated progress bar
// ---------------------------------------------------------------------------

function ActiveWorkColumn({
  label,
  count,
  total,
  color,
  gradientFrom,
  gradientTo,
  pulse,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  pulse?: boolean;
}) {
  const pct = total > 0 ? Math.max(2, (count / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[#111827] p-4 ring-1 ring-[#263244]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">
          {label}
        </p>
        {pulse && count > 0 && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: color }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          </span>
        )}
      </div>
      <p className="font-mono text-3xl font-bold leading-none" style={{ color }}>
        <CountUp to={count} decimals={0} />
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full bg-gradient-to-r ${gradientFrom} ${gradientTo} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-[#64748B]">
        {total > 0 ? `${Math.round((count / total) * 100)}% du total` : "—"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UpcomingDeadlinesList — premium deadline rows
// ---------------------------------------------------------------------------

function UpcomingDeadlinesList({
  rows,
  today,
}: {
  rows: UpcomingTask[];
  today: Date;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#64748B]">
        Aucune échéance à venir.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[#1E293B]">
      {rows.map((task) => {
        const due = new Date(task.deadline);
        const days = Math.floor(
          (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        const isOverdue = days < 0;
        const isToday = days === 0;
        const isSoon = days > 0 && days <= 2;

        return (
          <li key={task.id}>
            <Link
              href={`/dashboard/tasks/${task.id}`}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/4"
            >
              {/* Assignee avatar */}
              {task.assignee ? (
                <Avatar
                  src={task.assignee.avatar}
                  name={task.assignee.name}
                  size="sm"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1E293B] text-xs text-[#64748B]">
                  ?
                </span>
              )}

              {/* Title + project */}
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-medium ${
                    isOverdue ? "text-[#F43F5E]" : "text-[#F8FAFC]"
                  }`}
                >
                  {task.title}
                </p>
                <p className="truncate text-[11px] text-[#64748B]">
                  {task.client} · {task.project}
                </p>
              </div>

              {/* Priority badge */}
              <StatusBadge status={task.priority} type="priority" />

              {/* Due date chip */}
              <span
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  isOverdue
                    ? "bg-[#F43F5E]/15 text-[#F43F5E]"
                    : isToday
                      ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                      : isSoon
                        ? "bg-[#38BDF8]/10 text-[#38BDF8]"
                        : "bg-white/5 text-[#64748B]"
                }`}
              >
                {isOverdue
                  ? `${Math.abs(days)}j retard`
                  : isToday
                    ? "Aujourd'hui"
                    : `J+${days}`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// RecentDocsFeed
// ---------------------------------------------------------------------------

function RecentDocsFeed({ rows }: { rows: RecentDevis[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#64748B]">
        Aucun document récent.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[#1E293B]">
      {rows.map((d) => {
        const baseUrl =
          d.kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";
        return (
          <li key={d.id}>
            <Link
              href={`${baseUrl}/${d.id}`}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/4"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  d.kind === "facture"
                    ? "bg-[#7c4dff]/20 text-[#A78BFA]"
                    : "bg-[#38BDF8]/10 text-[#38BDF8]"
                }`}
              >
                {d.kind === "facture" ? "FA" : "DE"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#F8FAFC]">
                  {d.client_name}
                </p>
                <p className="truncate text-[11px] text-[#64748B]">
                  {formatDevisNumber(d.devis_number, d.kind)} · {formatDate(d.date)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={d.payment_status || d.status} type="finance" />
                <MoneyAmount amount={d.total_dt} size="sm" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// MyTasksList (worker/freelancer)
// ---------------------------------------------------------------------------

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

        const myStatusTone: Record<string, "slate" | "blue" | "amber" | "green"> =
          {
            todo: "slate",
            in_progress: "blue",
            review: "amber",
            done: "green",
          };

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

// ---------------------------------------------------------------------------
// FeaturedCard — kept exactly as before
// ---------------------------------------------------------------------------

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
    <Card interactive className="relative overflow-hidden border-0 p-0">
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

        <div className="min-w-0 flex-1 space-y-2.5 sm:pt-3">
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

// ---------------------------------------------------------------------------
// FeaturedEmptyCta
// ---------------------------------------------------------------------------

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
            <p className="text-sm font-semibold text-ink">{t.featured.empty}</p>
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
