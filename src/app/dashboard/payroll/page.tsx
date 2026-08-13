import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toBusinessDateKey } from "@/lib/format";
import { loadPayrollPeriod } from "@/lib/payroll-data";
import { periodBounds, workingDaysInMonth } from "@/lib/payroll";
import { WorkerPayroll } from "./worker-payroll";
import { AdminPayrollClient, type AdminPayrollWorker } from "./admin-payroll-client";

export const metadata = { title: "Points & salaires — Areen CUBs" };

export default async function PayrollPage() {
  const session = await requireRoles(["admin", "worker"]);
  const supabase = await createClient();
  const today = toBusinessDateKey(new Date())!;
  const [year, month] = today.split("-").map(Number);
  const { start, next } = periodBounds(year, month);
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  const previous = periodBounds(previousYear, previousMonth);

  if (session.role === "worker") {
    const [calculation, { data: history }] = await Promise.all([
      loadPayrollPeriod(supabase, session.id, start, next),
      supabase
        .from("payroll_payments")
        .select("id, period_start, earned_millimes, payout_millimes, target_millimes, output_points, status, paid_at")
        .eq("user_id", session.id)
        .order("period_start", { ascending: false })
        .limit(24),
    ]);
    return (
      <WorkerPayroll
        workerName={session.full_name ?? session.username}
        periodStart={start}
        calculation={calculation}
        workingDays={workingDaysInMonth(year, month)}
        history={history ?? []}
      />
    );
  }

  const [profilesRes, settingsRes, typesRes, bonusesRes, paymentsRes] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name").eq("role", "worker").order("full_name"),
    supabase.from("payroll_worker_settings").select("user_id, target_millimes, baseline_percent, active"),
    supabase.from("payroll_task_types").select("id, code, label, base_rate_millimes, above_rate_millimes, output_points, active").order("position"),
    supabase.from("payroll_bonuses").select("id, user_id, bonus_date, amount_millimes, reason").gte("bonus_date", start).lt("bonus_date", next).order("bonus_date", { ascending: false }),
    supabase.from("payroll_payments").select("id, user_id, period_start, payout_millimes, status, paid_at").order("period_start", { ascending: false }).limit(60),
  ]);
  const settings = new Map((settingsRes.data ?? []).map((item) => [item.user_id, item]));
  const workers: AdminPayrollWorker[] = await Promise.all(
    (profilesRes.data ?? []).map(async (profile) => ({
      ...profile,
      setting: settings.get(profile.id) ?? null,
      calculation: await loadPayrollPeriod(supabase, profile.id, start, next),
      previousCalculation: await loadPayrollPeriod(supabase, profile.id, previous.start, previous.next),
    })),
  );

  return (
    <AdminPayrollClient
      today={today}
      previousPeriodStart={previous.start}
      workers={workers}
      taskTypes={typesRes.data ?? []}
      bonuses={bonusesRes.data ?? []}
      payments={paymentsRes.data ?? []}
    />
  );
}
