import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OverviewClient } from "./overview-client";
import { getDonutPalette } from "@/components/charts/palette";

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfThisYear = new Date(now.getFullYear(), 0, 1);

  // 12-month window for the bars
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
  ).toISOString();

  const [
    activeProjects,
    activeTasks,
    teamSize,
    clientsCount,
    devisYTD,
    paymentsYTD,
    serviceLines,
    recentDevis,
    upcomingTasks,
    featured,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["todo", "in_progress", "review"]),
    session.role === "admin"
      ? supabase.from("profiles").select("id", { count: "exact", head: true })
      : Promise.resolve({ count: null }),
    session.role !== "freelancer"
      ? supabase.from("clients").select("id", { count: "exact", head: true })
      : Promise.resolve({ count: null }),
    // All non-rejected non-draft devis from this year and previous month for trends + bars
    session.role === "admin"
      ? supabase
          .from("devis")
          .select("id, date, total_dt, status, payment_status")
          .gte("date", oldestStart.slice(0, 10))
      : Promise.resolve({ data: null as Array<{
          id: string;
          date: string;
          total_dt: number;
          status: string;
          payment_status: string;
        }> | null }),
    session.role === "admin"
      ? supabase
          .from("payments")
          .select("amount_dt, paid_at")
          .gte("paid_at", oldestStart.slice(0, 10))
      : Promise.resolve({ data: null as Array<{
          amount_dt: number;
          paid_at: string;
        }> | null }),
    session.role === "admin"
      ? supabase
          .from("devis_items")
          .select(
            "line_total_dt, is_bonus, services:service_id(name_fr), devis:devis_id(status, date)",
          )
      : Promise.resolve({ data: null }),
    session.role === "admin"
      ? supabase
          .from("devis")
          .select(
            "id, kind, devis_number, total_dt, status, payment_status, date, clients:client_id(name)",
          )
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null }),
    supabase
      .from("tasks")
      .select(
        "id, title, deadline, priority, status, projects:project_id(name, clients:client_id(name)), profiles:assignee_id(username, full_name, avatar_url)",
      )
      .not("deadline", "is", null)
      .in("status", ["todo", "in_progress", "review"])
      .order("deadline", { ascending: true })
      .limit(6),
    supabase
      .from("featured_employees")
      .select(
        "month, reason, user_id, profiles:user_id(username, full_name, role, avatar_url)",
      )
      .eq("month", monthKey)
      .maybeSingle(),
  ]);

  // ---- Compute trend (this month vs last month) ----
  let mtdInvoiced = 0;
  let prevInvoiced = 0;
  let mtdPaid = 0;
  let prevPaid = 0;
  let totalOutstanding = 0;
  let outstandingPrev = 0;

  for (const d of devisYTD.data ?? []) {
    if (d.status === "rejected" || d.status === "draft") continue;
    const dt = new Date(d.date);
    if (dt >= startOfMonth) mtdInvoiced += Number(d.total_dt ?? 0);
    else if (dt >= startOfPrevMonth) prevInvoiced += Number(d.total_dt ?? 0);
  }
  for (const p of paymentsYTD.data ?? []) {
    const dt = new Date(p.paid_at);
    if (dt >= startOfMonth) mtdPaid += Number(p.amount_dt ?? 0);
    else if (dt >= startOfPrevMonth) prevPaid += Number(p.amount_dt ?? 0);
  }
  // Outstanding: sum of unpaid devis (anytime). Prev-month outstanding is
  // approximated as devis dated before this month with payment_status != paid.
  for (const d of devisYTD.data ?? []) {
    if (d.payment_status === "paid") continue;
    if (d.status === "rejected" || d.status === "draft") continue;
    totalOutstanding += Number(d.total_dt ?? 0);
    if (new Date(d.date) < startOfMonth) {
      outstandingPrev += Number(d.total_dt ?? 0);
    }
  }

  function pctTrend(current: number, prev: number): number | null {
    if (prev === 0) return current > 0 ? 100 : null;
    return ((current - prev) / prev) * 100;
  }

  // ---- Monthly bars ----
  const paidByMonth = new Map<string, number>();
  for (const p of paymentsYTD.data ?? []) {
    const d = new Date(p.paid_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    paidByMonth.set(k, (paidByMonth.get(k) ?? 0) + Number(p.amount_dt ?? 0));
  }
  const invoicedByMonth = new Map<string, number>();
  for (const d of devisYTD.data ?? []) {
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

  // ---- Service breakdown donut (top 6 + Other) ----
  type ServiceTally = { name: string; total_dt: number };
  const serviceTally = new Map<string, ServiceTally>();
  for (const line of (serviceLines.data ?? []) as Array<{
    line_total_dt: number;
    is_bonus: boolean;
    services?: { name_fr?: string } | { name_fr?: string }[] | null;
    devis?: { status?: string } | { status?: string }[] | null;
  }>) {
    if (line.is_bonus) continue;
    const parent = Array.isArray(line.devis) ? line.devis[0] : line.devis;
    if (parent?.status !== "accepted" && parent?.status !== "sent") continue;
    const svc = Array.isArray(line.services) ? line.services[0] : line.services;
    const name = svc?.name_fr ?? "Autre";
    const t = serviceTally.get(name) ?? { name, total_dt: 0 };
    t.total_dt += Number(line.line_total_dt ?? 0);
    serviceTally.set(name, t);
  }
  const allServices = Array.from(serviceTally.values()).sort(
    (a, b) => b.total_dt - a.total_dt,
  );
  const topSlices = allServices.slice(0, 6);
  const restTotal = allServices
    .slice(6)
    .reduce((s, t) => s + t.total_dt, 0);
  const palette = getDonutPalette();
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

  // ---- Featured employee ----
  let featuredEmployee:
    | {
        username: string;
        full_name: string | null;
        avatar_url: string | null;
        reason: string | null;
        month: string;
      }
    | null = null;
  if (featured?.data) {
    const p = Array.isArray(featured.data.profiles)
      ? featured.data.profiles[0]
      : featured.data.profiles;
    if (p) {
      featuredEmployee = {
        username: p.username,
        full_name: p.full_name ?? null,
        avatar_url: p.avatar_url ?? null,
        reason: featured.data.reason ?? null,
        month: featured.data.month,
      };
    }
  }

  // ---- Recent devis activity ----
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
  const recentDevisRows: RecentDevis[] = (recentDevis.data ?? []).map((d) => {
    const c = Array.isArray(d.clients) ? d.clients[0] : d.clients;
    return {
      id: d.id,
      kind: (d.kind as "devis" | "facture") ?? "devis",
      devis_number: d.devis_number,
      total_dt: Number(d.total_dt),
      status: d.status,
      payment_status: d.payment_status,
      date: d.date,
      client_name: c?.name ?? "—",
    };
  });

  // ---- Upcoming tasks ----
  type UpcomingTask = {
    id: string;
    title: string;
    deadline: string;
    priority: string;
    project: string;
    client: string;
    assignee: { name: string; avatar: string | null } | null;
  };
  const upcomingTasksRows: UpcomingTask[] = (upcomingTasks.data ?? []).map(
    (tk) => {
      const project = Array.isArray(tk.projects) ? tk.projects[0] : tk.projects;
      const client = project
        ? Array.isArray(project.clients)
          ? project.clients[0]
          : project.clients
        : null;
      const assignee = Array.isArray(tk.profiles)
        ? tk.profiles[0]
        : tk.profiles;
      return {
        id: tk.id,
        title: tk.title,
        deadline: tk.deadline as string,
        priority: tk.priority,
        project: project?.name ?? "—",
        client: client?.name ?? "—",
        assignee: assignee
          ? {
              name: assignee.full_name ?? `@${assignee.username}`,
              avatar: assignee.avatar_url ?? null,
            }
          : null,
      };
    },
  );

  return (
    <OverviewClient
      role={session.role}
      fullName={session.full_name ?? session.username}
      counts={{
        activeProjects: activeProjects.count ?? 0,
        activeTasks: activeTasks.count ?? 0,
        teamSize: teamSize.count,
        clients: clientsCount.count,
      }}
      revenue={{
        mtdInvoiced,
        mtdPaid,
        outstanding: totalOutstanding,
        invoicedTrend: pctTrend(mtdInvoiced, prevInvoiced),
        paidTrend: pctTrend(mtdPaid, prevPaid),
        outstandingTrend: pctTrend(totalOutstanding, outstandingPrev),
      }}
      monthlySeries={monthlySeries}
      donutData={donutData}
      recentDevis={recentDevisRows}
      upcomingTasks={upcomingTasksRows}
      featuredEmployee={featuredEmployee}
    />
  );
}
