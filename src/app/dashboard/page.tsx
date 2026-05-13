import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OverviewClient } from "./overview-client";
import { getDonutPalette } from "@/components/charts/palette";
import {
  StaleDevisBanner,
  type StaleDevisRow,
} from "@/components/stale-devis-banner";
import { PriorityPinsSection } from "./priorities-section";

// Defensive helper so one failing query can't take down the whole page.
async function safe<T>(
  fn: () => Promise<T>,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[overview:${label}]`, err);
    return fallback;
  }
}

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // 12-month window for bars
  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleDateString("fr-FR", { month: "short" }),
    });
  }
  const oldestStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    .toISOString()
    .slice(0, 10);

  const isAdmin = session.role === "admin";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  // Work-schedule window: 3 months centered on current
  const scheduleStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
  const scheduleEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)
    .toISOString()
    .slice(0, 10);

  // ---- Counts (all roles, RLS already filters freelancer to own rows) ----
  const activeProjects = await safe(
    async () => {
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      return count ?? 0;
    },
    0,
    "activeProjects",
  );

  // For admin / worker we show TOTAL active tasks. For freelancer the RLS
  // already constrains to own tasks. For worker we ALSO want a "my" count.
  const totalActiveTasks = await safe(
    async () => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .in("status", ["todo", "in_progress", "review"])
        .is("parent_task_id", null);
      return count ?? 0;
    },
    0,
    "totalActiveTasks",
  );

  const myActiveTasks = await safe(
    async () => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assignee_id", session.id)
        .in("status", ["todo", "in_progress", "review"])
        .is("parent_task_id", null);
      return count ?? 0;
    },
    0,
    "myActiveTasks",
  );

  const myOverdueTasks = await safe(
    async () => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assignee_id", session.id)
        .in("status", ["todo", "in_progress", "review"])
        .lt("deadline", todayIso)
        .is("parent_task_id", null);
      return count ?? 0;
    },
    0,
    "myOverdueTasks",
  );

  const teamSize: number | null = isAdmin
    ? await safe(
        async () => {
          const { count } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true });
          return count ?? 0;
        },
        0,
        "teamSize",
      )
    : null;

  const clientsCount: number | null =
    session.role !== "freelancer"
      ? await safe(
          async () => {
            const { count } = await supabase
              .from("clients")
              .select("id", { count: "exact", head: true });
            return count ?? 0;
          },
          0,
          "clientsCount",
        )
      : null;

  // ---- Admin-only finance data ----
  type DevisRow = {
    id: string;
    date: string;
    total_dt: number;
    status: string;
    payment_status: string;
  };
  type PaymentRow = { amount_dt: number; paid_at: string };

  const devisRows: DevisRow[] = isAdmin
    ? await safe(
        async () => {
          const { data } = await supabase
            .from("devis")
            .select("id, date, total_dt, status, payment_status")
            .gte("date", oldestStart);
          return (data ?? []) as DevisRow[];
        },
        [],
        "devis",
      )
    : [];
  const paymentRows: PaymentRow[] = isAdmin
    ? await safe(
        async () => {
          const { data } = await supabase
            .from("payments")
            .select("amount_dt, paid_at")
            .gte("paid_at", oldestStart);
          return (data ?? []) as PaymentRow[];
        },
        [],
        "payments",
      )
    : [];

  let mtdInvoiced = 0,
    prevInvoiced = 0,
    mtdPaid = 0,
    prevPaid = 0,
    totalOutstanding = 0,
    outstandingPrev = 0;

  for (const d of devisRows) {
    if (d.status === "rejected" || d.status === "draft") continue;
    const dt = new Date(d.date);
    if (dt >= startOfMonth) mtdInvoiced += Number(d.total_dt ?? 0);
    else if (dt >= startOfPrevMonth) prevInvoiced += Number(d.total_dt ?? 0);
  }
  for (const p of paymentRows) {
    const dt = new Date(p.paid_at);
    if (dt >= startOfMonth) mtdPaid += Number(p.amount_dt ?? 0);
    else if (dt >= startOfPrevMonth) prevPaid += Number(p.amount_dt ?? 0);
  }
  for (const d of devisRows) {
    if (d.payment_status === "paid") continue;
    if (d.status === "rejected" || d.status === "draft") continue;
    totalOutstanding += Number(d.total_dt ?? 0);
    if (new Date(d.date) < startOfMonth)
      outstandingPrev += Number(d.total_dt ?? 0);
  }

  function pctTrend(c: number, p: number): number | null {
    if (p === 0) return c > 0 ? 100 : null;
    return ((c - p) / p) * 100;
  }

  const paidByMonth = new Map<string, number>();
  for (const p of paymentRows) {
    const d = new Date(p.paid_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    paidByMonth.set(k, (paidByMonth.get(k) ?? 0) + Number(p.amount_dt ?? 0));
  }
  const invoicedByMonth = new Map<string, number>();
  for (const d of devisRows) {
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

  // ---- Service donut (admin) ----
  type ServiceLine = {
    line_total_dt: number;
    is_bonus: boolean;
    services: { name_fr?: string } | { name_fr?: string }[] | null;
    devis: { status?: string } | { status?: string }[] | null;
  };
  const serviceLines: ServiceLine[] = isAdmin
    ? await safe(
        async () => {
          const { data } = await supabase
            .from("devis_items")
            .select(
              "line_total_dt, is_bonus, services:service_id(name_fr), devis:devis_id(status)",
            );
          return (data ?? []) as ServiceLine[];
        },
        [],
        "serviceLines",
      )
    : [];
  const serviceTally = new Map<string, { name: string; total_dt: number }>();
  for (const line of serviceLines) {
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
  const palette = getDonutPalette();
  const topSlices = allServices.slice(0, 6);
  const restTotal = allServices.slice(6).reduce((s, t) => s + t.total_dt, 0);
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

  // ---- Recent devis (admin) ----
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
  const recentDevis: RecentDevis[] = isAdmin
    ? await safe(
        async () => {
          const { data } = await supabase
            .from("devis")
            .select(
              "id, kind, devis_number, total_dt, status, payment_status, date, clients:client_id(name)",
            )
            .order("created_at", { ascending: false })
            .limit(5);
          return (data ?? []).map((d) => {
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
        },
        [] as RecentDevis[],
        "recentDevis",
      )
    : [];

  // ---- Upcoming tasks ----
  // Admin: everyone's nearest 6 with deadlines.
  // Worker / freelancer: MY upcoming deadlines (filtered server-side).
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
  const upcomingTasks: UpcomingTask[] = await safe(
    async () => {
      let q = supabase
        .from("tasks")
        .select(
          "id, title, deadline, priority, status, assignee_id, projects:project_id(name, clients:client_id(name)), profiles:assignee_id(username, full_name, avatar_url)",
        )
        .not("deadline", "is", null)
        .in("status", ["todo", "in_progress", "review"])
        .is("parent_task_id", null)
        .order("deadline", { ascending: true })
        .limit(isAdmin ? 6 : 10);

      if (!isAdmin) q = q.eq("assignee_id", session.id);

      const { data } = await q;
      return (data ?? []).map((tk) => {
        const project = Array.isArray(tk.projects) ? tk.projects[0] : tk.projects;
        const c = project
          ? Array.isArray(project.clients)
            ? project.clients[0]
            : project.clients
          : null;
        const a = Array.isArray(tk.profiles) ? tk.profiles[0] : tk.profiles;
        return {
          id: tk.id,
          title: tk.title,
          deadline: tk.deadline as string,
          priority: tk.priority,
          status: tk.status,
          project: project?.name ?? "—",
          client: c?.name ?? "—",
          assignee: a
            ? {
                name: a.full_name ?? `@${a.username}`,
                avatar: a.avatar_url ?? null,
              }
            : null,
        };
      });
    },
    [] as UpcomingTask[],
    "upcomingTasks",
  );

  // ---- My work schedule (3-month window around current) ----
  const myWorkSchedule: Record<string, "office" | "home"> = await safe(
    async () => {
      const { data } = await supabase
        .from("work_schedule")
        .select("date, location")
        .eq("user_id", session.id)
        .gte("date", scheduleStart)
        .lte("date", scheduleEnd);
      const out: Record<string, "office" | "home"> = {};
      for (const row of data ?? []) {
        out[row.date as string] = row.location as "office" | "home";
      }
      return out;
    },
    {} as Record<string, "office" | "home">,
    "workSchedule",
  );

  // ---- Stale "sent" devis (admin) — for follow-up banner ----
  const staleDevis: StaleDevisRow[] = isAdmin
    ? await safe(
        async () => {
          const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
          const { data } = await supabase
            .from("devis")
            .select(
              "id, kind, devis_number, total_dt, date, clients:client_id(name)",
            )
            .eq("status", "sent")
            .eq("payment_status", "unpaid")
            .lte("date", cutoff)
            .order("date", { ascending: true })
            .limit(8);
          return (data ?? []).map((d) => {
            const c = Array.isArray(d.clients) ? d.clients[0] : d.clients;
            const days = Math.floor(
              (Date.now() - new Date(d.date).getTime()) / 86400000,
            );
            return {
              id: d.id,
              kind: (d.kind as "devis" | "facture") ?? "devis",
              devis_number: d.devis_number,
              client_name: c?.name ?? "—",
              total_dt: Number(d.total_dt),
              date: d.date,
              days_since_sent: days,
            };
          });
        },
        [] as StaleDevisRow[],
        "staleDevis",
      )
    : [];

  // ---- Priority pins (current user's "today's priorities") ----
  type PriorityPin = {
    id: string;
    task: {
      id: string;
      title: string;
      status: string;
      priority: string;
      deadline: string | null;
      project_name: string | null;
      client_name: string | null;
    };
  };
  const priorityPins: PriorityPin[] = await safe(
    async () => {
      const { data } = await supabase
        .from("priority_pins")
        .select(
          "id, task_id, tasks:task_id(id, title, status, priority, deadline, projects:project_id(name, clients:client_id(name)))",
        )
        .eq("user_id", session.id)
        .order("pinned_at", { ascending: true });
      return (data ?? [])
        .map((row) => {
          const tk = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
          if (!tk) return null;
          const proj = Array.isArray(tk.projects)
            ? tk.projects[0]
            : tk.projects;
          const cli = proj
            ? Array.isArray(proj.clients)
              ? proj.clients[0]
              : proj.clients
            : null;
          return {
            id: row.id,
            task: {
              id: tk.id,
              title: tk.title,
              status: tk.status,
              priority: tk.priority,
              deadline: tk.deadline,
              project_name: proj?.name ?? null,
              client_name: cli?.name ?? null,
            },
          };
        })
        .filter((x): x is PriorityPin => x !== null);
    },
    [] as PriorityPin[],
    "priorityPins",
  );

  // ---- Featured employee ----
  type FeaturedEmployee = {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    reason: string | null;
    month: string;
  } | null;
  const featuredEmployee: FeaturedEmployee = await safe(
    async () => {
      const { data } = await supabase
        .from("featured_employees")
        .select(
          "month, reason, user_id, profiles:user_id(username, full_name, role, avatar_url)",
        )
        .eq("month", monthKey)
        .maybeSingle();
      if (!data) return null;
      const p = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      if (!p) return null;
      return {
        username: p.username,
        full_name: p.full_name ?? null,
        avatar_url: p.avatar_url ?? null,
        reason: data.reason ?? null,
        month: data.month,
      };
    },
    null,
    "featured",
  );

  return (
    <div className="space-y-7">
      {isAdmin && staleDevis.length > 0 && (
        <StaleDevisBanner rows={staleDevis} />
      )}
      {priorityPins.length > 0 && (
        <PriorityPinsSection
          pins={priorityPins.map((p) => ({
            pinId: p.id,
            taskId: p.task.id,
            title: p.task.title,
            status: p.task.status,
            priority: p.task.priority,
            deadline: p.task.deadline,
            project: p.task.project_name,
            client: p.task.client_name,
          }))}
        />
      )}
      <OverviewClient
        role={session.role}
        fullName={session.full_name ?? session.username}
        counts={{
          activeProjects,
          activeTasks: isAdmin ? totalActiveTasks : myActiveTasks,
          teamSize,
          clients: clientsCount,
          myActiveTasks,
          myOverdueTasks,
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
        recentDevis={recentDevis}
        upcomingTasks={upcomingTasks}
        featuredEmployee={featuredEmployee}
        workSchedule={myWorkSchedule}
      />
    </div>
  );
}
