"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDt, formatDate } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { OutstandingTable, type OutstandingRow } from "./outstanding-table";
import { ExpensesTab, type ExpenseRow } from "./expenses-tab";
import { DevisPipelineTab } from "./devis-pipeline-tab";
import { FacturesTab } from "./factures-tab";
import { ClientProfilesTab, type ClientProfile } from "./client-profiles-tab";
import { AuditTab, type AuditData } from "./audit-tab";
import { useI18n } from "@/lib/i18n/provider";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ---------------------------------------------------------------------------
// Types — keep EXACTLY as-is
// ---------------------------------------------------------------------------

type MonthlySeries = { label: string; paid: number; invoiced: number; expenses: number; profit: number };
type ServiceTally = { name: string; nameEn?: string | null; total_dt: number; count: number };
type TopClient = { id: string; name: string; paid: number; invoiced: number; unpaid: number; overdue: number; risk: string };

export type FactureWithBalance = {
  id: string;
  devis_number: number;
  date: string;
  due_date: string;
  total_dt: number;
  paid_dt: number;
  balance_dt: number;
  status: string;
  payment_status: string;
  computed_status: "draft" | "sent" | "partial" | "paid" | "overdue" | "cancelled";
  client_id: string | null;
};

export type DevisRow = {
  id: string;
  devis_number: number;
  date: string;
  due_date: string;
  total_dt: number;
  status: string;
  payment_status: string;
  client_id: string | null;
  client_name: string;
};

type Props = {
  mtdPaid: number; prevPaid: number;
  mtdInvoiced: number; prevInvoiced: number;
  qtdPaid: number;
  totalOutstanding: number; totalOverdue: number; expectedNext30: number;
  mtdExpenses: number; netProfit: number; profitMargin: number | null;
  monthlySeries: MonthlySeries[];
  expByCategory: Record<string, number>;
  topServices: ServiceTally[];
  topClients: TopClient[];
  outstandingRows: OutstandingRow[];
  paymentsSoon: OutstandingRow[];
  totalDevisSent: number; totalDevisAccepted: number; totalDevisRejected: number;
  conversionRate: number; expectedRevenue: number; lostRevenue: number; avgDealSize: number;
  devisRows: DevisRow[];
  facturesWithBalance: FactureWithBalance[];
  expenseRows: ExpenseRow[];
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  clientProfiles: ClientProfile[];
  today: string;
  auditData: AuditData;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(c: number, p: number): number | null {
  if (p === 0) return null;
  return ((c - p) / p) * 100;
}

function isNew(c: number, p: number): boolean {
  return p === 0 && c > 0;
}

function noData(c: number, _p: number): boolean {
  return c === 0;
}

// ---------------------------------------------------------------------------
// Chart palette
// ---------------------------------------------------------------------------

const CHART_COLORS = {
  paid:     "#22C55E",
  invoiced: "#22D3EE",
  expenses: "#F43F5E",
  profit:   "#A78BFA",
};

const PIE_PALETTE = [
  "#22D3EE", "#22C55E", "#A78BFA", "#F59E0B",
  "#F43F5E", "#FB923C", "#34D399", "#818CF8",
];

// ---------------------------------------------------------------------------
// Custom Recharts Tooltip
// ---------------------------------------------------------------------------

function DarkTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#22506F] bg-[#123A5A] px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1.5 font-semibold text-[#94A3B8]">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-[#94A3B8]">{p.name}:</span>
          <span className="font-semibold text-[#F8FAFC]">{p.value.toLocaleString("fr-TN")} DT</span>
        </div>
      ))}
    </div>
  );
}

function PieDarkTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-[#22506F] bg-[#123A5A] px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: entry.payload.color }} />
        <span className="text-[#94A3B8]">{entry.name}:</span>
        <span className="font-semibold text-[#F8FAFC]">{entry.value.toLocaleString("fr-TN")} DT</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Area chart
// ---------------------------------------------------------------------------

function RevenueAreaChart({ series, labels }: {
  series: MonthlySeries[];
  labels: { collected: string; invoiced: string; expenses: string; profit: string };
}) {
  const { t } = useI18n();
  if (!series.length) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-[#64748B]">
        {t.finance.noData}
      </div>
    );
  }

  const data = series.map((s) => ({
    name: s.label,
    [labels.collected]: s.paid,
    [labels.invoiced]:  s.invoiced,
    [labels.expenses]:  s.expenses,
    [labels.profit]:    s.profit,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_COLORS.paid}     stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.paid}     stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradInvoiced" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_COLORS.invoiced} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.invoiced} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_COLORS.expenses} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.expenses} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_COLORS.profit}   stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.profit}   stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="#22506F" strokeDasharray="4 2" vertical={false} />

        <XAxis
          dataKey="name"
          tick={{ fill: "#64748B", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748B", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
          width={42}
        />

        <RechartsTooltip content={<DarkTooltip />} />

        <Legend
          wrapperStyle={{ fontSize: 11, color: "#94A3B8", paddingTop: 12 }}
          iconType="circle"
          iconSize={8}
        />

        <Area type="monotone" dataKey={labels.collected} stroke={CHART_COLORS.paid}     strokeWidth={2} fill="url(#gradPaid)"      dot={false} activeDot={{ r: 4, fill: CHART_COLORS.paid }} />
        <Area type="monotone" dataKey={labels.invoiced}  stroke={CHART_COLORS.invoiced} strokeWidth={2} fill="url(#gradInvoiced)"  dot={false} activeDot={{ r: 4, fill: CHART_COLORS.invoiced }} />
        <Area type="monotone" dataKey={labels.expenses}  stroke={CHART_COLORS.expenses} strokeWidth={2} fill="url(#gradExpenses)"  dot={false} activeDot={{ r: 4, fill: CHART_COLORS.expenses }} />
        <Area type="monotone" dataKey={labels.profit}    stroke={CHART_COLORS.profit}   strokeWidth={2} fill="url(#gradProfit)"    dot={false} activeDot={{ r: 4, fill: CHART_COLORS.profit }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Recharts donut
// ---------------------------------------------------------------------------

function RechartsDonut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const { t } = useI18n();
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-[#64748B]">{t.finance.noData}</p>;
  }

  const pieData = data.map((d) => ({ name: d.label, value: d.value, color: d.color }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            dataKey="value"
            strokeWidth={0}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip content={<PieDarkTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-1.5">
        {data.map((d) => {
          const total = data.reduce((sum, x) => sum + x.value, 0);
          const pctVal = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
          return (
            <div key={d.label} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="min-w-0 flex-1 truncate text-[#94A3B8]">{d.label}</span>
              <span className="text-[#64748B]">{pctVal}%</span>
              <span className="font-semibold text-[#F8FAFC]">{d.value.toLocaleString("fr-TN")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini donut card
// ---------------------------------------------------------------------------

function MiniDonutCard({ title, subtitle, data }: {
  title: string;
  subtitle: string;
  data: { label: string; value: number; color: string }[];
}) {
  return (
    <div className="rounded-xl border border-[#22506F] bg-[#0D2D47] p-5">
      <div className="mb-1 text-sm font-semibold text-[#F8FAFC]">{title}</div>
      <div className="mb-4 text-xs text-[#64748B]">{subtitle}</div>
      <RechartsDonut data={data} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk badge
// ---------------------------------------------------------------------------

export function RiskBadge({ risk }: { risk: "good" | "late" | "risky" }) {
  const { t } = useI18n();
  if (risk === "good")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
        ● {t.finance.riskGood}
      </span>
    );
  if (risk === "late")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
        ● {t.finance.riskLate}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/60 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
      ● {t.finance.riskRisky}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dashboard tab
// ---------------------------------------------------------------------------

function DashboardTab(props: Props) {
  const { t, locale } = useI18n();
  const tf = t.finance;

  // Category labels from i18n
  const CATEGORY_LABELS: Record<string, string> = {
    salaries:    tf.catSalaries,
    freelancers: tf.catFreelancers,
    ads:         tf.catAds,
    software:    tf.catSoftware,
    hosting:     tf.catHosting,
    transport:   tf.catTransport,
    office:      tf.catOffice,
    production:  tf.catProduction,
    other:       tf.catOther,
  };

  // Chart series labels (locale-aware for Recharts dataKey)
  const chartLabels = {
    collected: tf.chartCollected,
    invoiced:  tf.chartInvoiced,
    expenses:  tf.chartExpenses,
    profit:    tf.chartProfit,
  };

  // Service donut — use nameEn when locale is EN; empty name → localized "no service"
  const serviceLabel = (s: ServiceTally) => {
    if (!s.name && !s.nameEn) return tf.donutNoService;
    return locale === "en" && s.nameEn ? s.nameEn : (s.name || tf.donutNoService);
  };
  const topSlices = props.topServices.slice(0, 6);
  const restTotal = props.topServices.slice(6).reduce((s, svc) => s + svc.total_dt, 0);
  const serviceDonut = [
    ...topSlices.map((s, i) => ({
      label: serviceLabel(s),
      value: s.total_dt,
      color: PIE_PALETTE[i % PIE_PALETTE.length],
    })),
    ...(restTotal > 0 ? [{ label: tf.donutOthers, value: restTotal, color: PIE_PALETTE[6 % PIE_PALETTE.length] }] : []),
  ];

  // Expense donut
  const expDonut = Object.entries(props.expByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([k, v], i) => ({ label: CATEGORY_LABELS[k] ?? k, value: v, color: PIE_PALETTE[i % PIE_PALETTE.length] }));

  // Top clients donut
  const clientDonut = props.topClients.slice(0, 6).map((c, i) => ({
    label: c.name,
    value: c.paid,
    color: PIE_PALETTE[i % PIE_PALETTE.length],
  }));

  return (
    <div className="space-y-6">
      {/* ── 8 KPI CARDS ─────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label={t.kpis.revenueMtd}
          value={props.mtdPaid}
          suffix=" DT"
          trend={pct(props.mtdPaid, props.prevPaid)}
          trendIsNew={isNew(props.mtdPaid, props.prevPaid)}
          trendNoData={noData(props.mtdPaid, props.prevPaid)}
          trendLabel={t.kpis.vsLastMonth}
          tone="green"
          tooltip={tf.tipRevenueMtd}
        />
        <KpiCard
          label={t.kpis.invoicedMonth}
          value={props.mtdInvoiced}
          suffix=" DT"
          trend={pct(props.mtdInvoiced, props.prevInvoiced)}
          trendIsNew={isNew(props.mtdInvoiced, props.prevInvoiced)}
          trendNoData={noData(props.mtdInvoiced, props.prevInvoiced)}
          trendLabel={t.kpis.vsLastMonth}
          tone="cyan"
          tooltip={tf.tipInvoicedMonth}
        />
        <KpiCard
          label={t.kpis.outstanding}
          value={props.totalOutstanding}
          suffix=" DT"
          tone={props.totalOverdue > 0 ? "red" : props.totalOutstanding > 0 ? "amber" : "neutral"}
          tooltip={tf.tipOutstanding}
        />
        <KpiCard
          label={t.kpis.overdue}
          value={props.totalOverdue}
          suffix=" DT"
          tone={props.totalOverdue > 0 ? "red" : "neutral"}
          tooltip={tf.tipOverdue}
        />
        <KpiCard
          label={tf.kpiExpensesMonth}
          value={props.mtdExpenses}
          suffix=" DT"
          tone="neutral"
          tooltip={tf.tipExpensesMonth}
        />
        <KpiCard
          label={tf.kpiNetProfit}
          value={props.netProfit}
          suffix=" DT"
          tone={props.netProfit >= 0 ? "green" : "red"}
          tooltip={tf.tipNetProfit}
        />
        <KpiCard
          label={props.profitMargin === null ? tf.kpiMarginNoData : tf.kpiMargin}
          value={props.profitMargin === null ? "N/A" : props.profitMargin}
          suffix={props.profitMargin === null ? "" : "%"}
          decimals={1}
          tone="violet"
          tooltip={props.profitMargin === null ? tf.tipMarginNoData : tf.tipMargin}
        />
        <KpiCard
          label={tf.kpiExpected30}
          value={props.expectedNext30}
          suffix=" DT"
          tone="cyan"
          tooltip={tf.tipExpected30}
        />
      </section>

      {/* ── MAIN AREA CHART ─────────────────────────────────────── */}
      <div className="rounded-xl border border-[#22506F] bg-[#0D2D47] p-5">
        <div className="mb-1 text-sm font-semibold text-[#F8FAFC]">{tf.chartTitle}</div>
        <div className="mb-4 text-xs text-[#64748B]">{tf.chartSubtitle}</div>
        <RevenueAreaChart series={props.monthlySeries} labels={chartLabels} />
      </div>

      {/* ── 3-COL DONUT CHARTS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <MiniDonutCard title={tf.donutServices}  subtitle={tf.donutServicesSubtitle} data={serviceDonut} />
        <MiniDonutCard title={tf.donutExpenses}  subtitle={tf.donutExpensesSubtitle} data={expDonut} />
        <MiniDonutCard title={tf.donutClients}   subtitle={tf.donutClientsSubtitle}  data={clientDonut} />
      </div>

      {/* ── OUTSTANDING + EXPECTED ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[#22506F] bg-[#0D2D47] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-[#F8FAFC]">{tf.outstandingTitle}</div>
            {props.totalOverdue > 0 && (
              <Badge tone="red">{formatDt(props.totalOverdue)} {tf.outstandingInLate}</Badge>
            )}
          </div>
          <OutstandingTable rows={props.outstandingRows.slice(0, 10)} />
        </div>

        <div className="rounded-xl border border-[#22506F] bg-[#0D2D47] p-5">
          <div className="mb-4 text-sm font-semibold text-[#F8FAFC]">{tf.paymentsTitle}</div>
          {props.paymentsSoon.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#64748B]">{tf.paymentsEmpty}</p>
          ) : (
            <ul className="divide-y divide-[#22506F]">
              {props.paymentsSoon.map((r) => (
                <li key={r.devis_id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[#F8FAFC]">{r.client_name}</p>
                    <p className="text-xs text-[#64748B]">
                      {tf.paymentsFacture(r.devis_number)} · {tf.paymentsDue} {formatDate(r.due_date)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[#22D3EE]">
                    {formatDt(r.outstanding_dt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── TOP CLIENTS TABLE ────────────────────────────────────── */}
      {props.topClients.length > 0 && (
        <div className="rounded-xl border border-[#22506F] bg-[#0D2D47] p-5">
          <div className="mb-4 text-sm font-semibold text-[#F8FAFC]">{tf.topClientsTitle}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#22506F] text-left">
                  <th className="pb-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">{tf.colClient}</th>
                  <th className="pb-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">{tf.colInvoiced}</th>
                  <th className="pb-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">{tf.colCollected}</th>
                  <th className="pb-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">{tf.colUnpaid}</th>
                  <th className="pb-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">{tf.colRisk}</th>
                </tr>
              </thead>
              <tbody>
                {props.topClients.map((c) => (
                  <tr key={c.id} className="border-b border-[#1A3E5C] last:border-0">
                    <td className="py-2.5 font-medium text-[#F8FAFC]">{c.name}</td>
                    <td className="py-2.5 text-right text-[#94A3B8]">{formatDt(c.invoiced)}</td>
                    <td className="py-2.5 text-right font-semibold text-[#22C55E]">{formatDt(c.paid)}</td>
                    <td className="py-2.5 text-right text-[#94A3B8]">{c.unpaid > 0 ? formatDt(c.unpaid) : "—"}</td>
                    <td className="py-2.5 text-right">
                      <RiskBadge risk={c.risk as "good" | "late" | "risky"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function FinanceDashboardClient(props: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<string>("dashboard");

  const TABS = [
    { key: "dashboard", label: t.finance.tabDashboard },
    { key: "factures",  label: t.finance.tabFactures },
    { key: "devis",     label: t.finance.tabDevis },
    { key: "expenses",  label: t.finance.tabExpenses },
    { key: "clients",   label: t.finance.tabClients },
    { key: "audit",     label: t.finance.tabAudit },
  ];

  return (
    <div className="space-y-6">
      {/* ── TAB STRIP ───────────────────────────────────────────── */}
      <div className="bg-[#071B2C] border-b border-[#22506F]">
        <div className="flex overflow-x-auto">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              type="button"
              onClick={() => setTab(tabItem.key)}
              className={cn(
                "flex-shrink-0 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                tab === tabItem.key
                  ? "border-b-2 border-[#22D3EE] text-[#22D3EE]"
                  : "border-b-2 border-transparent text-[#64748B] hover:text-[#94A3B8]",
              )}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ─────────────────────────────────────────── */}
      {tab === "dashboard" && <DashboardTab {...props} />}
      {tab === "factures" && (
        <FacturesTab
          rows={props.facturesWithBalance}
          clients={props.clients}
          today={props.today}
        />
      )}
      {tab === "devis" && (
        <DevisPipelineTab
          rows={props.devisRows}
          totalSent={props.totalDevisSent}
          totalAccepted={props.totalDevisAccepted}
          totalRejected={props.totalDevisRejected}
          conversionRate={props.conversionRate}
          expectedRevenue={props.expectedRevenue}
          lostRevenue={props.lostRevenue}
          avgDealSize={props.avgDealSize}
        />
      )}
      {tab === "expenses" && (
        <ExpensesTab
          rows={props.expenseRows}
          projects={props.projects}
          clients={props.clients}
          expByCategory={props.expByCategory}
          mtdExpenses={props.mtdExpenses}
        />
      )}
      {tab === "clients" && <ClientProfilesTab profiles={props.clientProfiles} />}
      {tab === "audit"   && <AuditTab data={props.auditData} />}
    </div>
  );
}
