"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDt, formatDate } from "@/lib/format";
import { CountUp } from "@/components/charts/count-up";
import { TrendPill } from "@/components/charts/trend-pill";
import { MonthlyBars } from "@/components/charts/bars";
import { Donut, DonutLegend } from "@/components/charts/donut";
import { getDonutPalette } from "@/components/charts/palette";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OutstandingTable, type OutstandingRow } from "./outstanding-table";
import { ExpensesTab, type ExpenseRow } from "./expenses-tab";
import { DevisPipelineTab } from "./devis-pipeline-tab";
import { FacturesTab } from "./factures-tab";
import { ClientProfilesTab, type ClientProfile } from "./client-profiles-tab";

type MonthlySeries = { label: string; paid: number; invoiced: number; expenses: number; profit: number };
type ServiceTally = { name: string; total_dt: number; count: number };
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
  mtdExpenses: number; netProfit: number; profitMargin: number;
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
};

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "factures",  label: "Factures" },
  { key: "devis",     label: "Pipeline devis" },
  { key: "expenses",  label: "Dépenses" },
  { key: "clients",   label: "Clients" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function pct(c: number, p: number): number | null {
  if (p === 0) return c > 0 ? 100 : null;
  return ((c - p) / p) * 100;
}

export function FinanceDashboardClient(props: Props) {
  const [tab, setTab] = useState<TabKey>("dashboard");

  return (
    <div className="space-y-6">
      {/* Tab strip */}
      <div className="flex gap-1 rounded-xl border border-ink/8 bg-white/40 p-1 backdrop-blur-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              tab === t.key
                ? "bg-brand text-white shadow-sm"
                : "text-ink/60 hover:bg-white/60 hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab {...props} />}
      {tab === "factures"  && <FacturesTab rows={props.facturesWithBalance} clients={props.clients} today={props.today} />}
      {tab === "devis"     && (
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
      {tab === "expenses"  && (
        <ExpensesTab
          rows={props.expenseRows}
          projects={props.projects}
          clients={props.clients}
          expByCategory={props.expByCategory}
          mtdExpenses={props.mtdExpenses}
        />
      )}
      {tab === "clients"   && <ClientProfilesTab profiles={props.clientProfiles} />}
    </div>
  );
}

function DashboardTab(props: Props) {
  const palette = getDonutPalette();

  // Service donut
  const topSlices = props.topServices.slice(0, 6);
  const restTotal = props.topServices.slice(6).reduce((s, t) => s + t.total_dt, 0);
  const serviceDonut = [
    ...topSlices.map((s, i) => ({ label: s.name, value: s.total_dt, color: palette[i % palette.length] })),
    ...(restTotal > 0 ? [{ label: "Autres", value: restTotal, color: palette[6 % palette.length] }] : []),
  ];

  // Expense donut
  const CATEGORY_LABELS: Record<string, string> = {
    salaries: "Salaires", freelancers: "Freelances", ads: "Publicité",
    software: "Logiciels", hosting: "Hébergement", transport: "Transport",
    office: "Bureau", production: "Production", other: "Autre",
  };
  const expDonut = Object.entries(props.expByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([k, v], i) => ({ label: CATEGORY_LABELS[k] ?? k, value: v, color: palette[i % palette.length] }));

  // Top clients donut
  const clientDonut = props.topClients.slice(0, 6).map((c, i) => ({
    label: c.name,
    value: c.paid,
    color: palette[i % palette.length],
  }));

  return (
    <div className="space-y-6">
      {/* ── 8 KPI CARDS ─────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Encaissé (mois)" value={props.mtdPaid} trend={pct(props.mtdPaid, props.prevPaid)} tone="green" suffix=" DT" />
        <KpiCard label="Facturé (mois)" value={props.mtdInvoiced} trend={pct(props.mtdInvoiced, props.prevInvoiced)} tone="brand" suffix=" DT" />
        <KpiCard label="Impayés total" value={props.totalOutstanding} tone={props.totalOutstanding > 0 ? "amber" : "neutral"} suffix=" DT" />
        <KpiCard label="En retard" value={props.totalOverdue} tone={props.totalOverdue > 0 ? "red" : "neutral"} suffix=" DT" />
        <KpiCard label="Dépenses (mois)" value={props.mtdExpenses} tone="ink" suffix=" DT" />
        <KpiCard label="Profit net (mois)" value={props.netProfit} tone={props.netProfit >= 0 ? "green" : "red"} suffix=" DT" />
        <KpiCard label="Marge bénéficiaire" value={props.profitMargin} tone={props.profitMargin >= 50 ? "green" : props.profitMargin >= 20 ? "amber" : "red"} suffix="%" decimals={1} />
        <KpiCard label="Attendu 30j" value={props.expectedNext30} tone="brand" suffix=" DT" />
      </section>

      {/* ── MAIN CHART ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Encaissé vs Facturé vs Dépenses — 12 mois</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyBars series={props.monthlySeries} height={240} />
        </CardContent>
      </Card>

      {/* ── 3-COL CHARTS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <MiniDonutCard title="Services (factures)" subtitle="Répartition par chiffre d'affaires" data={serviceDonut} />
        <MiniDonutCard title="Dépenses par catégorie" subtitle="Toutes périodes" data={expDonut} />
        <MiniDonutCard title="Top clients (encaissé)" subtitle="Tous temps" data={clientDonut} />
      </div>

      {/* ── OUTSTANDING + ACTIONS ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Factures impayées</CardTitle>
              {props.totalOverdue > 0 && (
                <Badge tone="red">{formatDt(props.totalOverdue)} en retard</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <OutstandingTable rows={props.outstandingRows.slice(0, 10)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paiements attendus (30j)</CardTitle>
          </CardHeader>
          <CardContent>
            {props.paymentsSoon.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink/45">Aucun paiement attendu dans les 30 prochains jours.</p>
            ) : (
              <ul className="divide-y divide-ink/8">
                {props.paymentsSoon.map((r) => (
                  <li key={r.devis_id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-ink">{r.client_name}</p>
                      <p className="text-xs text-ink/50">Facture #{r.devis_number} · échéance {formatDate(r.due_date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-brand">{formatDt(r.outstanding_dt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── TOP CLIENTS TABLE ────────────────────────────────────── */}
      {props.topClients.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Meilleurs clients</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/8 text-left text-xs font-semibold uppercase tracking-wider text-ink/45">
                    <th className="pb-2">Client</th>
                    <th className="pb-2 text-right">Facturé</th>
                    <th className="pb-2 text-right">Encaissé</th>
                    <th className="pb-2 text-right">Impayé</th>
                    <th className="pb-2 text-right">Risque</th>
                  </tr>
                </thead>
                <tbody>
                  {props.topClients.map((c) => (
                    <tr key={c.id} className="border-b border-ink/5 last:border-0">
                      <td className="py-2 font-medium text-ink">{c.name}</td>
                      <td className="py-2 text-right text-ink/70">{formatDt(c.invoiced)}</td>
                      <td className="py-2 text-right font-semibold text-emerald-700">{formatDt(c.paid)}</td>
                      <td className="py-2 text-right text-ink/70">{c.unpaid > 0 ? formatDt(c.unpaid) : "—"}</td>
                      <td className="py-2 text-right">
                        <RiskBadge risk={c.risk as "good" | "late" | "risky"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  label, value, trend, tone = "neutral", suffix = "", decimals = 0,
}: {
  label: string; value: number; trend?: number | null;
  tone?: "green" | "brand" | "amber" | "red" | "ink" | "neutral";
  suffix?: string; decimals?: number;
}) {
  const ribbon = {
    green: "bg-emerald-500", brand: "bg-brand", amber: "bg-accent",
    red: "bg-red-500", ink: "bg-ink", neutral: "bg-ink/20",
  }[tone];
  const valueColor = {
    green: "text-emerald-700", brand: "text-brand-dark", amber: "text-accent-dark",
    red: "text-red-600", ink: "text-ink", neutral: "text-ink",
  }[tone];
  return (
    <Card interactive className="relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${ribbon}`} />
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">{label}</p>
        <p className={`mt-2.5 text-2xl font-bold tracking-tight ${valueColor}`}>
          <CountUp to={value} suffix={suffix} decimals={decimals} />
        </p>
        {trend !== undefined && (
          <div className="mt-1 flex items-center gap-1.5">
            <TrendPill pct={trend} />
            <span className="text-[10px] text-ink/40">vs mois dernier</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniDonutCard({ title, subtitle, data }: { title: string; subtitle: string; data: { label: string; value: number; color: string }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-xs text-ink/50">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-4">
            <Donut data={data} size={180} thickness={20} />
            <DonutLegend data={data} />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-ink/40">Pas encore de données.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskBadge({ risk }: { risk: "good" | "late" | "risky" }) {
  if (risk === "good") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">● Bon</span>;
  if (risk === "late") return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">● En retard</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">● Risqué</span>;
}
