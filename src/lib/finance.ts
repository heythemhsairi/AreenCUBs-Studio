/**
 * Finance calculation helpers — single source of truth.
 *
 * Rules enforced here:
 *  1. Encaissé  = payments linked to FACTURES only
 *                 (devis payments that have a linked facture are excluded —
 *                  their migrated copy on the facture is counted instead)
 *  2. Facturé   = facture totals only (kind = 'facture')
 *  3. Impayés   = facture balance_due > 0 (= total_dt - sum payments on facture)
 *  4. Overdue   = impayé where due_date < today
 *  5. Pipeline  = accepted devis NOT yet converted (no facture child)
 *  6. Profit    = encaissé − expenses
 *  7. NEVER count devis + facture totals for the same deal
 */

import { createClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────────

export type PeriodFilter = {
  from: string; // ISO date
  to: string;   // ISO date
};

export type FinanceSummary = {
  // Collected = real money in
  collectedTotal: number;
  collectedMtd: number;
  collectedPrevMonth: number;
  collectedQtd: number;

  // Invoiced = billed (factures only)
  invoicedTotal: number;
  invoicedMtd: number;
  invoicedPrevMonth: number;

  // Unpaid invoice balances
  unpaidBalance: number;
  overdueBalance: number;
  expectedNext30: number;

  // Expenses
  expensesMtd: number;
  expensesTotal: number;

  // Profit
  profitMtd: number;
  profitMarginMtd: number; // %

  // Pipeline (devis not yet converted)
  pipelineExpected: number;
  pipelineLost: number;

  // Audit
  convertedDevisExcluded: number; // payments excluded from devis that have facture
};

export type InvoicePaymentSummary = {
  invoiceId: string;
  totalDt: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: "unpaid" | "partial" | "paid" | "overdue";
  isOverdue: boolean;
  payments: {
    id: string;
    amount_dt: number;
    paid_at: string;
    method: string | null;
    migrated_from_devis: boolean;
  }[];
};

export type ClientFinanceSummary = {
  clientId: string;
  invoiced: number;
  collected: number;
  unpaid: number;
  overdue: number;
  lastPaymentDate: string | null;
  risk: "good" | "late" | "risky";
};

// ── Core query helpers ────────────────────────────────────────────

/**
 * Returns collected revenue = sum of payments on FACTURES only.
 * Excludes devis-level payments that have been superseded by a
 * facture (source_devis_id IS NOT NULL on the devis table means
 * the devis has a linked facture; those devis payments are ignored).
 */
export async function getCollectedAmount(
  period?: PeriodFilter,
): Promise<number> {
  const supabase = await createClient();

  // Payments on factures only
  let q = supabase
    .from("payments")
    .select("amount_dt, devis:devis_id(kind)")
    .filter("devis.kind", "eq", "facture");

  if (period) {
    q = q.gte("paid_at", period.from).lte("paid_at", period.to);
  }

  const { data } = await q;
  return (data ?? [])
    .filter((p) => {
      const d = Array.isArray(p.devis) ? p.devis[0] : p.devis;
      return (d as { kind?: string } | null)?.kind === "facture";
    })
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);
}

/**
 * Returns invoiced amount = sum of facture totals issued in period.
 */
export async function getInvoicedAmount(
  period?: PeriodFilter,
): Promise<number> {
  const supabase = await createClient();

  let q = supabase
    .from("devis")
    .select("total_dt")
    .eq("kind", "facture")
    .neq("status", "rejected");

  if (period) {
    q = q.gte("date", period.from).lte("date", period.to);
  }

  const { data } = await q;
  return (data ?? []).reduce((s, f) => s + Number(f.total_dt ?? 0), 0);
}

/**
 * Returns unpaid invoice balance (total_dt - payments) for all open factures.
 */
export async function getUnpaidBalance(today: string): Promise<{
  total: number;
  overdue: number;
  expectedNext30: number;
}> {
  const supabase = await createClient();
  const next30 = new Date(new Date(today).getTime() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [{ data: factures }, { data: payments }] = await Promise.all([
    supabase
      .from("devis")
      .select("id, total_dt, due_date, payment_status")
      .eq("kind", "facture")
      .in("payment_status", ["unpaid", "partial"])
      .neq("status", "rejected"),
    supabase
      .from("payments")
      .select("devis_id, amount_dt"),
  ]);

  const paidMap = new Map<string, number>();
  for (const p of payments ?? []) {
    paidMap.set(p.devis_id, (paidMap.get(p.devis_id) ?? 0) + Number(p.amount_dt ?? 0));
  }

  let total = 0, overdue = 0, expectedNext30 = 0;
  for (const f of factures ?? []) {
    const paid = paidMap.get(f.id) ?? 0;
    const balance = Math.max(0, Number(f.total_dt) - paid);
    if (balance <= 0.01) continue;
    total += balance;
    if (f.due_date < today) overdue += balance;
    else if (f.due_date <= next30) expectedNext30 += balance;
  }

  return { total, overdue, expectedNext30 };
}

/**
 * Full finance summary for the dashboard.
 * All amounts in DT.
 */
export async function getFinanceSummary(now: Date): Promise<FinanceSummary> {
  const supabase = await createClient();
  const todayStr  = now.toISOString().slice(0, 10);
  const next30Str = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  const mtdFrom   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const prevFrom  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const prevTo    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  const qtdFrom   = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().slice(0, 10);
  const oldest12  = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);

  const [
    { data: allPayments },
    { data: allFactures },
    { data: unpaidFactures },
    { data: allExpenses },
    { data: allDevis },
  ] = await Promise.all([
    // Payments only
    supabase
      .from("payments")
      .select("id, devis_id, amount_dt, paid_at"),
    // All factures
    supabase
      .from("devis")
      .select("id, total_dt, date, due_date, payment_status, status, client_id")
      .eq("kind", "facture")
      .gte("date", oldest12),
    // Unpaid/partial factures
    supabase
      .from("devis")
      .select("id, total_dt, due_date, payment_status")
      .eq("kind", "facture")
      .in("payment_status", ["unpaid", "partial"])
      .neq("status", "rejected"),
    // Expenses
    supabase
      .from("expenses")
      .select("amount_dt, expense_date"),
    // Devis for pipeline
    supabase
      .from("devis")
      .select("id, total_dt, status")
      .eq("kind", "devis")
      .gte("date", oldest12),
  ]);

  // Build set of facture IDs to know which payments are on factures
  const factureIds = new Set((allFactures ?? []).map((f) => f.id));

  // Build map: devis_id → payments (all)
  const paysByDoc = new Map<string, number>();
  for (const p of allPayments ?? []) {
    paysByDoc.set(p.devis_id, (paysByDoc.get(p.devis_id) ?? 0) + Number(p.amount_dt ?? 0));
  }

  // RULE: Encaissé = only payments whose devis_id is a FACTURE
  const facturePayments = (allPayments ?? []).filter((p) => factureIds.has(p.devis_id));

  const collectedMtd = facturePayments
    .filter((p) => p.paid_at >= mtdFrom)
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  const collectedPrevMonth = facturePayments
    .filter((p) => p.paid_at >= prevFrom && p.paid_at <= prevTo)
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  const collectedQtd = facturePayments
    .filter((p) => p.paid_at >= qtdFrom)
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  const collectedTotal = facturePayments
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  // RULE: Facturé = facture totals only
  const invoicedMtd = (allFactures ?? [])
    .filter((f) => f.date >= mtdFrom && f.status !== "rejected")
    .reduce((s, f) => s + Number(f.total_dt ?? 0), 0);

  const invoicedPrevMonth = (allFactures ?? [])
    .filter((f) => f.date >= prevFrom && f.date <= prevTo && f.status !== "rejected")
    .reduce((s, f) => s + Number(f.total_dt ?? 0), 0);

  const invoicedTotal = (allFactures ?? [])
    .filter((f) => f.status !== "rejected")
    .reduce((s, f) => s + Number(f.total_dt ?? 0), 0);

  // RULE: Impayés = unpaid invoice balance only
  let unpaidBalance = 0, overdueBalance = 0, expectedNext30 = 0;
  for (const f of unpaidFactures ?? []) {
    const paid = paysByDoc.get(f.id) ?? 0;
    const balance = Math.max(0, Number(f.total_dt) - paid);
    if (balance <= 0.01) continue;
    unpaidBalance += balance;
    if (f.due_date < todayStr) overdueBalance += balance;
    else if (f.due_date <= next30Str) expectedNext30 += balance;
  }

  // Expenses
  const expensesMtd = (allExpenses ?? [])
    .filter((e) => e.expense_date >= mtdFrom)
    .reduce((s, e) => s + Number(e.amount_dt ?? 0), 0);
  const expensesTotal = (allExpenses ?? [])
    .reduce((s, e) => s + Number(e.amount_dt ?? 0), 0);

  // Profit
  const profitMtd = collectedMtd - expensesMtd;
  const profitMarginMtd = collectedMtd > 0 ? (profitMtd / collectedMtd) * 100 : 0;

  // Pipeline = accepted devis NOT converted (no facture with this parent_devis_id)
  // We need to check which devis have a linked facture
  const { data: convertedDevisIds } = await supabase
    .from("devis")
    .select("parent_devis_id")
    .eq("kind", "facture")
    .not("parent_devis_id", "is", null);

  const convertedSet = new Set((convertedDevisIds ?? []).map((r) => r.parent_devis_id));

  const pipelineExpected = (allDevis ?? [])
    .filter((d) => d.status === "accepted" && !convertedSet.has(d.id))
    .reduce((s, d) => s + Number(d.total_dt ?? 0), 0);

  const pipelineLost = (allDevis ?? [])
    .filter((d) => d.status === "rejected")
    .reduce((s, d) => s + Number(d.total_dt ?? 0), 0);

  // How many devis payments were excluded (superseded by facture)
  const convertedDevisPayments = (allPayments ?? [])
    .filter((p) => convertedSet.has(p.devis_id));
  const convertedDevisExcluded = convertedDevisPayments
    .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  return {
    collectedTotal, collectedMtd, collectedPrevMonth, collectedQtd,
    invoicedTotal, invoicedMtd, invoicedPrevMonth,
    unpaidBalance, overdueBalance, expectedNext30,
    expensesMtd, expensesTotal,
    profitMtd, profitMarginMtd,
    pipelineExpected, pipelineLost,
    convertedDevisExcluded,
  };
}

/**
 * Payment summary for a single invoice (facture).
 */
export async function getInvoicePaymentSummary(
  invoiceId: string,
  today: string,
): Promise<InvoicePaymentSummary | null> {
  const supabase = await createClient();

  const [{ data: inv }, { data: pays }] = await Promise.all([
    supabase
      .from("devis")
      .select("id, total_dt, due_date, payment_status")
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("payments")
      .select("id, amount_dt, paid_at, method, migrated_from_devis")
      .eq("devis_id", invoiceId)
      .order("paid_at", { ascending: true }),
  ]);

  if (!inv) return null;

  const amountPaid = (pays ?? []).reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);
  const total = Number(inv.total_dt ?? 0);
  const balanceDue = Math.max(0, total - amountPaid);
  const isOverdue = inv.due_date < today && balanceDue > 0.01;

  let paymentStatus: InvoicePaymentSummary["paymentStatus"] = "unpaid";
  if (amountPaid >= total - 0.01) paymentStatus = "paid";
  else if (amountPaid > 0) paymentStatus = isOverdue ? "overdue" : "partial";
  else if (isOverdue) paymentStatus = "overdue";

  return {
    invoiceId,
    totalDt: total,
    amountPaid,
    balanceDue,
    paymentStatus,
    isOverdue,
    payments: (pays ?? []).map((p) => ({
      id: p.id,
      amount_dt: Number(p.amount_dt),
      paid_at: p.paid_at,
      method: p.method ?? null,
      migrated_from_devis: p.migrated_from_devis ?? false,
    })),
  };
}

/**
 * Finance summary for a single client.
 */
export async function getClientFinanceSummary(
  clientId: string,
  today: string,
): Promise<ClientFinanceSummary> {
  const supabase = await createClient();

  const [{ data: factures }, { data: payments }] = await Promise.all([
    supabase
      .from("devis")
      .select("id, total_dt, due_date, payment_status")
      .eq("kind", "facture")
      .eq("client_id", clientId)
      .neq("status", "rejected"),
    supabase
      .from("payments")
      .select("devis_id, amount_dt, paid_at")
      .order("paid_at", { ascending: false }),
  ]);

  const factureIds = new Set((factures ?? []).map((f) => f.id));
  const clientPayments = (payments ?? []).filter((p) => factureIds.has(p.devis_id));

  const invoiced = (factures ?? []).reduce((s, f) => s + Number(f.total_dt ?? 0), 0);
  const collected = clientPayments.reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);
  const unpaid = Math.max(0, invoiced - collected);
  const lastPaymentDate = clientPayments[0]?.paid_at ?? null;

  let overdue = 0;
  for (const f of factures ?? []) {
    const paid = clientPayments
      .filter((p) => p.devis_id === f.id)
      .reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);
    const bal = Math.max(0, Number(f.total_dt) - paid);
    if (bal > 0.01 && f.due_date < today) overdue += bal;
  }

  let risk: ClientFinanceSummary["risk"] = "good";
  if (overdue > 0) {
    const maxOverdueDays = (factures ?? [])
      .filter((f) => {
        const paid = clientPayments.filter((p) => p.devis_id === f.id).reduce((s, p) => s + Number(p.amount_dt), 0);
        return Math.max(0, Number(f.total_dt) - paid) > 0.01 && f.due_date < today;
      })
      .reduce((max, f) => {
        const days = Math.floor((new Date(today).getTime() - new Date(f.due_date).getTime()) / 86400000);
        return Math.max(max, days);
      }, 0);
    risk = maxOverdueDays >= 30 ? "risky" : "late";
  }

  return { clientId, invoiced, collected, unpaid, overdue, lastPaymentDate, risk };
}

/**
 * Service revenue breakdown — invoice line items only.
 */
export async function getServiceRevenueFromInvoices(period?: PeriodFilter): Promise<
  { name: string; total_dt: number; count: number }[]
> {
  const supabase = await createClient();

  let q = supabase
    .from("devis_items")
    .select("line_total_dt, is_bonus, services:service_id(name_fr), devis:devis_id(status, kind, date)");

  const { data: items } = await q;

  const tally = new Map<string, { name: string; total_dt: number; count: number }>();
  for (const item of items ?? []) {
    if (item.is_bonus) continue;
    const parent = Array.isArray(item.devis) ? item.devis[0] : item.devis;
    if ((parent as { kind?: string } | null)?.kind !== "facture") continue;
    if ((parent as { status?: string } | null)?.status === "rejected") continue;

    if (period) {
      const d = (parent as { date?: string } | null)?.date;
      if (!d || d < period.from || d > period.to) continue;
    }

    const svc = Array.isArray(item.services) ? item.services[0] : item.services;
    const name = (svc as { name_fr?: string } | null)?.name_fr ?? "Sans service";
    const t = tally.get(name) ?? { name, total_dt: 0, count: 0 };
    t.total_dt += Number(item.line_total_dt ?? 0);
    t.count += 1;
    tally.set(name, t);
  }

  return Array.from(tally.values()).sort((a, b) => b.total_dt - a.total_dt);
}

/**
 * Monthly series for the bar chart (12 months).
 * Encaissé = facture payments only, Facturé = facture totals only.
 */
export async function getMonthlyFinanceSeries(
  now: Date,
): Promise<{ label: string; paid: number; invoiced: number; expenses: number; profit: number }[]> {
  const supabase = await createClient();
  const oldest12 = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);

  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
    });
  }

  const [{ data: factures }, { data: payments }, { data: expenses }] = await Promise.all([
    supabase.from("devis").select("id, total_dt, date").eq("kind", "facture").gte("date", oldest12).neq("status", "rejected"),
    supabase.from("payments").select("devis_id, amount_dt, paid_at").gte("paid_at", oldest12),
    supabase.from("expenses").select("amount_dt, expense_date").gte("expense_date", oldest12),
  ]);

  const factureIds = new Set((factures ?? []).map((f) => f.id));

  const paidByMonth = new Map<string, number>();
  for (const p of payments ?? []) {
    if (!factureIds.has(p.devis_id)) continue; // Only count payments on factures
    const d = p.paid_at.slice(0, 7); // YYYY-MM
    paidByMonth.set(d, (paidByMonth.get(d) ?? 0) + Number(p.amount_dt ?? 0));
  }

  const invoicedByMonth = new Map<string, number>();
  for (const f of factures ?? []) {
    const d = (f.date as string).slice(0, 7);
    invoicedByMonth.set(d, (invoicedByMonth.get(d) ?? 0) + Number(f.total_dt ?? 0));
  }

  const expByMonth = new Map<string, number>();
  for (const e of expenses ?? []) {
    const d = (e.expense_date as string).slice(0, 7);
    expByMonth.set(d, (expByMonth.get(d) ?? 0) + Number(e.amount_dt ?? 0));
  }

  return months.map((m) => {
    const paid = paidByMonth.get(m.key) ?? 0;
    const exp  = expByMonth.get(m.key) ?? 0;
    return {
      label:    m.label,
      paid,
      invoiced: invoicedByMonth.get(m.key) ?? 0,
      expenses: exp,
      profit:   paid - exp,
    };
  });
}
