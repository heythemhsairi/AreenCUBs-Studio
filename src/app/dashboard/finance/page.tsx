import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { FinanceDashboardClient } from "./finance-client";

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
  const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const oldest12 = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    .toISOString()
    .slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);
  const next30Str = next30.toISOString().slice(0, 10);

  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
    });
  }

  const [
    { data: factureRows },
    { data: devisRows },
    { data: paymentRows },
    { data: allPayments },
    { data: unpaidFactures },
    { data: clientRows },
    { data: expenseRows },
    { data: projectRows },
    { data: factureItems },
    { data: allFactureData },
  ] = await Promise.all([
    // Facturé = factures only
    supabase
      .from("devis")
      .select("id, devis_number, date, due_date, total_dt, status, payment_status, client_id, clients:client_id(id, name)")
      .eq("kind", "facture")
      .gte("date", oldest12),
    // Devis pipeline
    supabase
      .from("devis")
      .select("id, devis_number, date, due_date, total_dt, status, payment_status, client_id, clients:client_id(id, name)")
      .eq("kind", "devis")
      .gte("date", oldest12),
    // Payments (last 12 months for KPIs/charts)
    supabase
      .from("payments")
      .select("id, devis_id, amount_dt, paid_at, method, notes")
      .gte("paid_at", oldest12),
    // All payments (for client balance)
    supabase
      .from("payments")
      .select("id, devis_id, amount_dt, paid_at, method, notes"),
    // Unpaid factures for outstanding table
    supabase
      .from("devis")
      .select("id, devis_number, date, due_date, total_dt, payment_status, status, client_id, last_followup_at, next_followup_at, contacted, clients:client_id(id, name)")
      .eq("kind", "facture")
      .in("payment_status", ["unpaid", "partial"])
      .neq("status", "rejected"),
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("expenses")
      .select("id, title, category, amount_dt, expense_date, project_id, client_id, vendor, payment_method, notes, created_at, projects:project_id(name), clients:client_id(name)")
      .order("expense_date", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
    supabase
      .from("devis_items")
      .select("line_total_dt, is_bonus, services:service_id(name_fr), devis:devis_id(status, kind)"),
    // All factures (for client profiles & status breakdown)
    supabase
      .from("devis")
      .select("id, devis_number, date, due_date, total_dt, status, payment_status, client_id")
      .eq("kind", "facture"),
  ]);

  // ── PAID-PER-DOC MAP ───────────────────────────────────────────
  const paidPerDoc = new Map<string, number>();
  for (const p of allPayments ?? []) {
    paidPerDoc.set(p.devis_id, (paidPerDoc.get(p.devis_id) ?? 0) + Number(p.amount_dt ?? 0));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── KPIs ───────────────────────────────────────────────────────
  const mtdPaid = (paymentRows ?? [])
    .filter((p) => new Date(p.paid_at) >= startOfMonth)
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  const prevPaid = (paymentRows ?? [])
    .filter((p) => { const d = new Date(p.paid_at); return d >= startOfPrevMonth && d < startOfMonth; })
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  const mtdInvoiced = (factureRows ?? [])
    .filter((f) => new Date(f.date) >= startOfMonth)
    .reduce((s, f) => s + Number(f.total_dt ?? 0), 0);

  const prevInvoiced = (factureRows ?? [])
    .filter((f) => { const d = new Date(f.date); return d >= startOfPrevMonth && d < startOfMonth; })
    .reduce((s, f) => s + Number(f.total_dt ?? 0), 0);

  const qtdPaid = (paymentRows ?? [])
    .filter((p) => new Date(p.paid_at) >= startOfQuarter)
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  const mtdExpenses = (expenseRows ?? [])
    .filter((e) => new Date(e.expense_date) >= startOfMonth)
    .reduce((s, e) => s + Number(e.amount_dt ?? 0), 0);

  const netProfit = mtdPaid - mtdExpenses;
  const profitMargin = mtdPaid > 0 ? (netProfit / mtdPaid) * 100 : 0;

  // ── OUTSTANDING ────────────────────────────────────────────────
  const outstandingRows = (unpaidFactures ?? [])
    .map((f) => {
      const client = Array.isArray(f.clients) ? f.clients[0] : f.clients;
      const paid = paidPerDoc.get(f.id) ?? 0;
      const balance = +(Number(f.total_dt) - paid).toFixed(2);
      const due = new Date(f.due_date);
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
      return {
        devis_id: f.id,
        devis_number: f.devis_number as number,
        client_id: (client as { id: string } | null)?.id ?? null,
        client_name: (client as { name: string } | null)?.name ?? "—",
        total_dt: Number(f.total_dt),
        paid_dt: paid,
        outstanding_dt: balance,
        due_date: f.due_date as string,
        days_overdue: daysOverdue,
        last_followup_at: (f.last_followup_at as string | null) ?? null,
        next_followup_at: (f.next_followup_at as string | null) ?? null,
        contacted: (f.contacted as boolean | null) ?? false,
      };
    })
    .filter((r) => r.outstanding_dt > 0.01)
    .sort((a, b) => b.days_overdue - a.days_overdue);

  const totalOutstanding = outstandingRows.reduce((s, r) => s + r.outstanding_dt, 0);
  const totalOverdue = outstandingRows.filter((r) => r.days_overdue > 0).reduce((s, r) => s + r.outstanding_dt, 0);
  const expectedNext30 = outstandingRows
    .filter((r) => r.days_overdue <= 0 && r.due_date <= next30Str)
    .reduce((s, r) => s + r.outstanding_dt, 0);

  // ── MONTHLY SERIES ─────────────────────────────────────────────
  const paidByMonth = new Map<string, number>();
  for (const p of paymentRows ?? []) {
    const d = new Date(p.paid_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    paidByMonth.set(k, (paidByMonth.get(k) ?? 0) + Number(p.amount_dt ?? 0));
  }
  const invoicedByMonth = new Map<string, number>();
  for (const f of factureRows ?? []) {
    const d = new Date(f.date);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    invoicedByMonth.set(k, (invoicedByMonth.get(k) ?? 0) + Number(f.total_dt ?? 0));
  }
  const expensesByMonth = new Map<string, number>();
  for (const e of expenseRows ?? []) {
    const d = new Date(e.expense_date);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    expensesByMonth.set(k, (expensesByMonth.get(k) ?? 0) + Number(e.amount_dt ?? 0));
  }
  const monthlySeries = months.map((m) => ({
    label: m.label,
    paid: paidByMonth.get(m.key) ?? 0,
    invoiced: invoicedByMonth.get(m.key) ?? 0,
    expenses: expensesByMonth.get(m.key) ?? 0,
    profit: (paidByMonth.get(m.key) ?? 0) - (expensesByMonth.get(m.key) ?? 0),
  }));

  // ── EXPENSE BY CATEGORY ────────────────────────────────────────
  const expByCategory: Record<string, number> = {};
  for (const e of expenseRows ?? []) {
    expByCategory[e.category] = (expByCategory[e.category] ?? 0) + Number(e.amount_dt ?? 0);
  }

  // ── SERVICE BREAKDOWN (factures only) ─────────────────────────
  type ServiceTally = { name: string; total_dt: number; count: number };
  const serviceTally = new Map<string, ServiceTally>();
  for (const line of factureItems ?? []) {
    if (line.is_bonus) continue;
    const parent = Array.isArray(line.devis) ? line.devis[0] : line.devis;
    if ((parent as { kind?: string } | null)?.kind !== "facture") continue;
    const svc = Array.isArray(line.services) ? line.services[0] : line.services;
    const name = (svc as { name_fr?: string } | null)?.name_fr ?? "Sans service";
    const t = serviceTally.get(name) ?? { name, total_dt: 0, count: 0 };
    t.total_dt += Number(line.line_total_dt ?? 0);
    t.count += 1;
    serviceTally.set(name, t);
  }
  const topServices = Array.from(serviceTally.values())
    .sort((a, b) => b.total_dt - a.total_dt)
    .slice(0, 10);

  // ── DEVIS PIPELINE ─────────────────────────────────────────────
  const allDevis = devisRows ?? [];
  const totalDevisSent = allDevis.filter((d) => d.status !== "draft").length;
  const totalDevisAccepted = allDevis.filter((d) => d.status === "accepted").length;
  const totalDevisRejected = allDevis.filter((d) => d.status === "rejected").length;
  const conversionRate = totalDevisSent > 0 ? (totalDevisAccepted / totalDevisSent) * 100 : 0;
  const expectedRevenue = allDevis.filter((d) => d.status === "accepted").reduce((s, d) => s + Number(d.total_dt ?? 0), 0);
  const lostRevenue = allDevis.filter((d) => d.status === "rejected").reduce((s, d) => s + Number(d.total_dt ?? 0), 0);
  const avgDealSize = totalDevisAccepted > 0 ? expectedRevenue / totalDevisAccepted : 0;

  const devisForClient = allDevis.map((d) => {
    const client = Array.isArray(d.clients) ? d.clients[0] : d.clients;
    return {
      id: d.id,
      devis_number: d.devis_number as number,
      date: d.date as string,
      due_date: d.due_date as string,
      total_dt: Number(d.total_dt),
      status: d.status as string,
      payment_status: d.payment_status as string,
      client_id: (client as { id: string } | null)?.id ?? null,
      client_name: (client as { name: string } | null)?.name ?? "—",
    };
  });

  // ── CLIENT PROFILES ────────────────────────────────────────────
  const clientBalMap = new Map<string, { invoiced: number; paid: number; overdue: number; lastPayDate: string | null }>();
  for (const f of allFactureData ?? []) {
    if (!f.client_id) continue;
    const cur = clientBalMap.get(f.client_id) ?? { invoiced: 0, paid: 0, overdue: 0, lastPayDate: null };
    cur.invoiced += Number(f.total_dt ?? 0);
    const paid = paidPerDoc.get(f.id) ?? 0;
    cur.paid += paid;
    const bal = Number(f.total_dt) - paid;
    if (bal > 0.01 && new Date(f.due_date) < today) cur.overdue += bal;
    clientBalMap.set(f.client_id, cur);
  }
  for (const p of allPayments ?? []) {
    const facture = (allFactureData ?? []).find((f) => f.id === p.devis_id);
    if (!facture?.client_id) continue;
    const cur = clientBalMap.get(facture.client_id);
    if (!cur) continue;
    if (!cur.lastPayDate || p.paid_at > cur.lastPayDate) cur.lastPayDate = p.paid_at as string;
  }

  const clientProfiles = (clientRows ?? [])
    .map((c) => {
      const bal = clientBalMap.get(c.id) ?? { invoiced: 0, paid: 0, overdue: 0, lastPayDate: null };
      const unpaid = Math.max(0, bal.invoiced - bal.paid);
      let risk: "good" | "late" | "risky" = "good";
      if (bal.overdue > 0) {
        const maxDays = (allFactureData ?? [])
          .filter((f) => f.client_id === c.id && (paidPerDoc.get(f.id) ?? 0) < Number(f.total_dt) - 0.01 && new Date(f.due_date) < today)
          .reduce((max, f) => Math.max(max, Math.floor((today.getTime() - new Date(f.due_date).getTime()) / 86400000)), 0);
        risk = maxDays >= 30 ? "risky" : "late";
      }
      return { id: c.id, name: c.name as string, invoiced: bal.invoiced, paid: bal.paid, unpaid, overdue: bal.overdue, lastPaymentDate: bal.lastPayDate, risk };
    })
    .filter((c) => c.invoiced > 0)
    .sort((a, b) => b.invoiced - a.invoiced);

  const topClients = [...clientProfiles].sort((a, b) => b.paid - a.paid).slice(0, 8);

  // ── FACTURES STATUS BREAKDOWN ──────────────────────────────────
  const facturesWithBalance = (allFactureData ?? []).map((f) => {
    const paid = paidPerDoc.get(f.id) ?? 0;
    const balance = +(Number(f.total_dt) - paid).toFixed(2);
    const isOverdue = new Date(f.due_date) < today && balance > 0.01;
    let computedStatus: "draft" | "sent" | "partial" | "paid" | "overdue" | "cancelled" = "sent";
    if (f.status === "draft") computedStatus = "draft";
    else if (f.status === "rejected") computedStatus = "cancelled";
    else if (paid >= Number(f.total_dt) - 0.01) computedStatus = "paid";
    else if (paid > 0) computedStatus = isOverdue ? "overdue" : "partial";
    else if (isOverdue) computedStatus = "overdue";
    else computedStatus = "sent";
    return {
      id: f.id,
      devis_number: f.devis_number as number,
      date: f.date as string,
      due_date: f.due_date as string,
      total_dt: Number(f.total_dt),
      paid_dt: paid,
      balance_dt: balance,
      status: f.status as string,
      payment_status: f.payment_status as string,
      computed_status: computedStatus,
      client_id: f.client_id as string | null,
    };
  });

  const paymentsSoon = outstandingRows
    .filter((r) => r.days_overdue <= 0 && r.due_date <= next30Str)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader title="Finance OS" subtitle="v2.0 — tableau de bord financier complet" />
      <FinanceDashboardClient
        mtdPaid={mtdPaid}
        prevPaid={prevPaid}
        mtdInvoiced={mtdInvoiced}
        prevInvoiced={prevInvoiced}
        qtdPaid={qtdPaid}
        totalOutstanding={totalOutstanding}
        totalOverdue={totalOverdue}
        expectedNext30={expectedNext30}
        mtdExpenses={mtdExpenses}
        netProfit={netProfit}
        profitMargin={profitMargin}
        monthlySeries={monthlySeries}
        expByCategory={expByCategory}
        topServices={topServices}
        topClients={topClients}
        outstandingRows={outstandingRows}
        paymentsSoon={paymentsSoon}
        totalDevisSent={totalDevisSent}
        totalDevisAccepted={totalDevisAccepted}
        totalDevisRejected={totalDevisRejected}
        conversionRate={conversionRate}
        expectedRevenue={expectedRevenue}
        lostRevenue={lostRevenue}
        avgDealSize={avgDealSize}
        devisRows={devisForClient}
        facturesWithBalance={facturesWithBalance}
        expenseRows={(expenseRows ?? []).map((e) => {
          const proj = Array.isArray(e.projects) ? e.projects[0] : e.projects;
          const cli = Array.isArray(e.clients) ? e.clients[0] : e.clients;
          return {
            id: e.id as string,
            title: e.title as string,
            category: e.category as string,
            amount_dt: Number(e.amount_dt),
            expense_date: e.expense_date as string,
            project_id: (e.project_id as string | null) ?? null,
            client_id: (e.client_id as string | null) ?? null,
            vendor: (e.vendor as string | null) ?? null,
            payment_method: (e.payment_method as string | null) ?? null,
            notes: (e.notes as string | null) ?? null,
            project_name: (proj as { name: string } | null)?.name ?? null,
            client_name: (cli as { name: string } | null)?.name ?? null,
          };
        })}
        projects={(projectRows ?? []).map((p) => ({ id: p.id as string, name: p.name as string }))}
        clients={(clientRows ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))}
        clientProfiles={clientProfiles}
        today={todayStr}
      />
    </div>
  );
}
