import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDt, formatDate } from "@/lib/format";
import { MonthlyRevenueBars } from "./monthly-revenue-bars";
import { TopServicesList } from "./top-services";
import { OutstandingTable } from "./outstanding-table";

const TVA_RATE = 19;

export default async function FinancePage() {
  await requireAdmin();
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(
    now.getFullYear(),
    Math.floor(now.getMonth() / 3) * 3,
    1,
  );

  // Twelve-month window for the bars (inclusive of current month)
  const months: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleDateString("fr-FR", {
        month: "short",
      }),
      start,
      end,
    });
  }
  const oldestStart = months[0].start.toISOString().slice(0, 10);

  // ---- Fetch in parallel ----
  const [
    { data: devisRows },
    { data: paymentRows },
    { data: serviceLines },
    { data: outstandingRows },
    { data: clientRowsForOutstanding },
  ] = await Promise.all([
    supabase
      .from("devis")
      .select("id, date, total_dt, status, payment_status")
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
        "id, devis_number, date, due_date, total_dt, payment_status, status, client_id, clients:client_id(id, name)",
      )
      .neq("payment_status", "paid")
      .neq("status", "rejected")
      .neq("status", "draft"),
    supabase
      .from("payments")
      .select("amount_dt, devis_id"),
  ]);

  // ---- Aggregate monthly revenue (paid vs invoiced; covers devis + factures) ----
  const paidByMonth = new Map<string, number>();
  for (const p of paymentRows ?? []) {
    const d = new Date(p.paid_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    paidByMonth.set(
      k,
      (paidByMonth.get(k) ?? 0) + Number(p.amount_dt ?? 0),
    );
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
  // Both devis and factures live in the same `devis` table — already counted.
  const monthlySeries = months.map((m) => ({
    label: m.label,
    paid: paidByMonth.get(m.key) ?? 0,
    invoiced: invoicedByMonth.get(m.key) ?? 0,
  }));

  // ---- KPIs ----
  const mtdPaid = (paymentRows ?? [])
    .filter((p) => new Date(p.paid_at) >= startOfMonth)
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);
  const mtdInvoiced = (devisRows ?? [])
    .filter(
      (d) =>
        new Date(d.date) >= startOfMonth &&
        d.status !== "rejected" &&
        d.status !== "draft",
    )
    .reduce((s, d) => s + Number(d.total_dt ?? 0), 0);
  const qtdPaid = (paymentRows ?? [])
    .filter((p) => new Date(p.paid_at) >= startOfQuarter)
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  // ---- Top services (by accepted-or-sent invoiced DT this quarter and all-time) ----
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

  // ---- Outstanding by client ----
  const paidPerDevis = new Map<string, number>();
  for (const p of clientRowsForOutstanding ?? []) {
    paidPerDevis.set(
      p.devis_id,
      (paidPerDevis.get(p.devis_id) ?? 0) + Number(p.amount_dt ?? 0),
    );
  }
  type OutstandingRow = {
    devis_id: string;
    devis_number: number;
    client_id: string | null;
    client_name: string;
    total_dt: number;
    paid_dt: number;
    outstanding_dt: number;
    due_date: string;
    days_overdue: number;
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const outstanding: OutstandingRow[] = (outstandingRows ?? [])
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
    <div className="space-y-6">
      <PageHeader
        title="Finances"
        subtitle="Vue d'ensemble du chiffre d'affaires, services et impayés"
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Encaissé (mois)" value={formatDt(mtdPaid)} tone="green" />
        <Kpi label="Facturé (mois)" value={formatDt(mtdInvoiced)} tone="blue" />
        <Kpi label="Encaissé (trimestre)" value={formatDt(qtdPaid)} />
        <Kpi
          label="Impayés"
          value={formatDt(totalOutstanding)}
          tone={totalOutstanding > 0 ? "amber" : "neutral"}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Chiffre d&apos;affaires — 12 mois</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyRevenueBars series={monthlySeries} />
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
            <Legend color="#1f4dd9" label="Facturé" />
            <Legend color="#16a34a" label="Encaissé" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top services (devis acceptés / envoyés)</CardTitle>
          </CardHeader>
          <CardContent>
            <TopServicesList services={topServices} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impayés par client</CardTitle>
          </CardHeader>
          <CardContent>
            <OutstandingTable rows={outstanding} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "blue" | "amber" | "neutral";
}) {
  const toneClass: Record<string, string> = {
    green: "text-green-700",
    blue: "text-brand",
    amber: "text-amber-700",
    neutral: "text-slate-900",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p
          className={`mt-2 text-2xl font-semibold ${toneClass[tone ?? "neutral"]}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
