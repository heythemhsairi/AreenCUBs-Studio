import "server-only";

import { calculatePayroll, type PayrollEntry } from "@/lib/payroll";

type QueryClient = {
  from: (table: string) => any; // Supabase's generated schema types are not present in this project.
};

export async function loadPayrollPeriod(
  supabase: QueryClient,
  userId: string,
  periodStart: string,
  nextPeriodStart: string,
) {
  const [{ data: setting }, { data: credits }, { data: bonuses }] = await Promise.all([
    supabase
      .from("payroll_worker_settings")
      .select("target_millimes, baseline_percent, active")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("payroll_task_credits")
      .select("id, task_id, completed_at, tasks:task_id(title), payroll_task_types:task_type_id(label, base_rate_millimes, above_rate_millimes, output_points)")
      .eq("user_id", userId)
      .gte("completed_at", `${periodStart}T00:00:00+01:00`)
      .lt("completed_at", `${nextPeriodStart}T00:00:00+01:00`)
      .order("completed_at"),
    supabase
      .from("payroll_bonuses")
      .select("id, bonus_date, amount_millimes, reason")
      .eq("user_id", userId)
      .gte("bonus_date", periodStart)
      .lt("bonus_date", nextPeriodStart)
      .order("bonus_date"),
  ]);

  if (!setting?.active) return null;

  const entries: PayrollEntry[] = [];
  for (const credit of credits ?? []) {
    const task = Array.isArray(credit.tasks) ? credit.tasks[0] : credit.tasks;
    const type = Array.isArray(credit.payroll_task_types)
      ? credit.payroll_task_types[0]
      : credit.payroll_task_types;
    if (!type) continue;
    entries.push({
      id: credit.id,
      kind: "task",
      label: `${type.label} · ${task?.title ?? "Tâche"}`,
      occurredAt: credit.completed_at,
      baseMillimes: type.base_rate_millimes,
      aboveMillimes: type.above_rate_millimes,
      points: type.output_points,
      taskId: credit.task_id,
    });
  }
  for (const bonus of bonuses ?? []) {
    entries.push({
      id: bonus.id,
      kind: "bonus",
      label: `Bonus · ${bonus.reason}`,
      occurredAt: bonus.bonus_date,
      baseMillimes: bonus.amount_millimes,
      aboveMillimes: Math.round(bonus.amount_millimes * 1.5),
      points: 0,
    });
  }

  return calculatePayroll(
    entries,
    setting.target_millimes,
    setting.baseline_percent,
  );
}
