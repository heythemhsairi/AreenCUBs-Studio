import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/charts/count-up";
import { TrendPill } from "@/components/charts/trend-pill";
import { Donut, DonutLegend, getDonutPalette } from "@/components/charts/donut";
import { MonthlyBars } from "@/components/charts/bars";
import { TopServicesList } from "./top-services";
import { OutstandingTable } from "./outstanding-table";

export default async function FinancePage() {
  await requireAdmin();
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfQuarter = new Date(
    now.getFullYear(),
    Math.floor(now.getMonth() / 3) * 3,
    1,
  );

  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleDateString("fr-FR", { month: "short" }),
    });
  }
  const oldestStart = new Date(
    now.getFullYear(),
    now.getMonth() - 11,
    1,
  ).toISOString().slice(0, 10);

  const [
    { data: devisRows },
    { data: paymentRows },
    { data: serviceLines },
    { data: outstandingRows },
    { data: paymentsByDevis },
  ] = await Promise.all([
    supabase
      .from("devis")
      .select("id, kind, date, total_dt, status, payment_status")
      .gte("date", oldestStart),
    supabase
      .from("payments")
      .select("amount_dt, paid_at")
      .gte("paid_at", oldestStart),
    supabase
      .from("devis_items")
      .select(
        "line_total_dt, is_bonus, services:service_id(name_fr), devis:devis_id(status)",
      ),
    supabase
      .from("devis")
      .select(
        "id, kind, devis_number, date, due_date, total_dt, payment_status, status, client_id, clients:client_id(id, name)",
      )
      .neq("payment_status", "paid")
      .neq("status", "rejected")
      .neq("status", "draft"),
    supabase.from("payments").select("amount_dt, devis_id"),
  ]);

  // ---- Monthly bars
  const paidByMonth = new Map<string, number>();
  for (const p of paymentRows ?? []) {
    const d = new Date(p.paid_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    paidByMonth.set(k, (paidByMonth.get(k) ?? 0) + Number(p.amount_dt ?? 0));
  }
  const invoicedByMonth = new Map<string, number>();
  for (const d of devisRows ?? []) {
    if (d.status === "rejected" || d.status === "draft") continue;
    const dt = new Date(d.date);
    const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    invoicedByMonth.set(
      k,
      (invoicedByMonth.get(k) ?? 0) + Number(d.total_dt ?? 0),
    );
  }
  const monthlySeries = months.map((m) => ({
    label: m.label,
    paid: paidByMonth.get(m.key) ?? 0,
    invoiced: invoicedByMonth.get(m.key) ?? 0,
  }));

  // ---- KPIs
  const mtdPaid = (paymentRows ?? [])
    .filter((p) => new Date(p.paid_at) >= startOfMonth)
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);
  const prevPaid = (paymentRows ?? [])
    .filter(
      (p) =>
        new Date(p.paid_at) >= startOfPrevMonth &&
        new Date(p.paid_at) < startOfMonth,
    )
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);
  const mtdInvoiced = (devisRows ?? [])
    .filter(
      (d) =>
        new Date(d.date) >= startOfMonth &&
        d.status !== "rejected" &&
        d.status !== "draft",
    )
    .reduce((s, d) => s + Number(d.total_dt ?? 0), 0);
  const prevInvoiced = (devisRows ?? [])
    .filter(
      (d) =>
        new Date(d.date) >= startOfPrevMonth &&
        new Date(d.date) < startOfMonth &&
        d.status !== "rejected" &&
        d.status !== "draft",
    )
    .reduce((s, d) => s + Number(d.total_dt ?? 0), 0);
  const qtdPaid = (paymentRows ?? [])
    .filter((p) => new Date(p.paid_at) >= startOfQuarter)
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  function pctTrend(c: number, p: number): number | null {
    if (p === 0) return c > 0 ? 100 : null;
    return ((c - p) / p) * 100;
  }

  // ---- Top services (for sidebar list + donut)
  type ServiceTally = { name: string; total_dt: number; count: number };
  const serviceTally = new Map<string, ServiceTally>();
  for (const line of serviceLines ?? []) {
    if (line.is_bonus) continue;
    const parent = Array.isArray(line.devis) ? line.devis[0] : line.devis;
    const status = parent?.status;
    if (status !== "accepted" && status !== "sent") continue;
    const svc = Array.isArray(line.services) ? line.services[0] : line.services;
    const name = svc?.name_fr ?? "—";
    const t = serviceTally.get(name) ?? { name, total_dt: 0, count: 0 };
    t.total_dt += Number(line.line_total_dt ?? 0);
    t.count += 1;
    serviceTally.set(name, t);
  }
  const topServices = Array.from(serviceTally.values())
    .sort((a, b) => b.total_dt - a.total_dt)
    .slice(0, 10);

  const palette = getDonutPalette();
  const topSlices = topServices.slice(0, 6);
  const restTotal = topServices.slice(6).reduce((s, t) => s + t.total_dt, 0);
  const donutData = [
    ...topSlices.map((s, i) => ({
      label: s.name,
      value: s.total_dt,
      color: palette[i % palette.length],
    })),
    ...(restTotal > 0
      ? [{ label: "Autres", value: restTotal, color: palette[6 % palette.length] }]
      : []),
  ];

  // ---- Outstanding by client
  const paidPerDevis = new Map<string, number>();
  for (const p of paymentsByDevis ?? []) {
    paidPerDevis.set(
      p.devis_id,
      (paidPerDevis.get(p.devis_id) ?? 0) + Number(p.amount_dt ?? 0),
    );
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const outstanding = (outstandingRows ?? [])
    .map((d) => {
      const client = Array.isArray(d.clients) ? d.clients[0] : d.clients;
      const paid = paidPerDevis.get(d.id) ?? 0;
      const outstandingDt = +(Number(d.total_dt) - paid).toFixed(2);
      const due = new Date(d.due_date);
      const daysOverdue = Math.floor(
        (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        devis_id: d.id,
        devis_number: d.devis_number,
        client_id: client?.id ?? null,
        client_name: client?.name ?? "—",
        total_dt: Number(d.total_dt),
        paid_dt: paid,
        outstanding_dt: outstandingDt,
        due_date: d.due_date,
        days_overdue: daysOverdue,
      };
    })
    .filter((r) => r.outstanding_dt > 0.01)
    .sort((a, b) => b.days_overdue - a.days_overdue);

  const totalOutstanding = outstanding.reduce(
    (s, r) => s + r.outstanding_dt,
    0,
  );

  return (
    <div className="space-y-7">
      <PageHeader
        title="Finances"
        subtitle="Cash-flow, services, impayés"
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Encaissé (mois)"
          value={mtdPaid}
          trend={pctTrend(mtdPaid, prevPaid)}
          tone="green"
        />
        <KpiTile
          label="Facturé (mois)"
          value={mtdInvoiced}
          trend={pctTrend(mtdInvoiced, prevInvoiced)}
          tone="brand"
        />
        <KpiTile
          label="Encaissé (trimestre)"
          value={qtdPaid}
          tone="ink"
        />
        <KpiTile
          label="Impayés"
          value={totalOutstanding}
          tone={totalOutstanding > 0 ? "amber" : "neutral"}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Chiffre d&apos;affaires — 12 mois</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyBars series={monthlySeries} height={220} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Services par revenu</CardTitle>
            <p className="text-xs text-ink/50">
              Devis envoyés &amp; acceptés
            </p>
          </CardHeader>
          <CardContent>
            {donutData.length > 0 ? (
              <div className="space-y-5">
                <Donut data={donutData} size={200} thickness={22} />
                <DonutLegend data={donutData} />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-ink/45">
                Pas encore de devis envoyés.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Top services</CardTitle>
          </CardHeader>
          <CardContent>
            <TopServicesList services={topServices} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Impayés</CardTitle>
              <Badge tone="amber">{outstanding.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <OutstandingTable rows={outstanding.slice(0, 8)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  trend,
  tone = "neutral",
}: {
  label: string;
  value: number;
  trend?: number | null;
  tone?: "green" | "brand" | "amber" | "ink" | "neutral";
}) {
  const ribbon =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "brand"
        ? "bg-brand"
        : tone === "amber"
          ? "bg-accent"
          : tone === "ink"
            ? "bg-ink"
            : "bg-ink/30";

  const valueColor =
    tone === "green"
      ? "text-emerald-700"
      : tone === "brand"
        ? "text-brand-dark"
        : tone === "amber"
          ? "text-accent-dark"
          : "text-ink";

  return (
    <Card interactive className="relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${ribbon}`} />
      <CardContent className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">
          {label}
        </p>
        <p
          className={`mt-3 text-3xl font-semibold tracking-tight ${valueColor}`}
        >
          <CountUp to={value} suffix=" DT" />
        </p>
        {trend !== undefined && (
          <div className="mt-1.5 flex items-center gap-2">
            <TrendPill pct={trend} />
            <span className="text-[11px] text-ink/45">vs mois dernier</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
