"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPayrollPeriod } from "@/lib/payroll-data";
import { toBusinessDateKey } from "@/lib/format";

type Result = { ok: true } | { ok: false; error: string };
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])-01$/;

function millimesFromForm(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 1000) : 0;
}

function nextPeriod(periodStart: string) {
  const [year, month] = periodStart.split("-").map(Number);
  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

export async function savePayrollTaskTypeAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const base = millimesFromForm(formData.get("base_rate_dt"));
  const above = millimesFromForm(formData.get("above_rate_dt"));
  const points = Number(formData.get("output_points"));
  if (!id || !label || base <= 0 || above <= 0 || !Number.isInteger(points) || points < 0) {
    return { ok: false, error: "Tarif ou points invalides." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_task_types").update({
    label,
    base_rate_millimes: base,
    above_rate_millimes: above,
    output_points: points,
    active: formData.get("active") === "on",
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/payroll");
  return { ok: true };
}

export async function saveWorkerPayrollAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const target = millimesFromForm(formData.get("target_dt"));
  const baseline = Number(formData.get("baseline_percent"));
  if (!userId || target <= 0 || !Number.isInteger(baseline) || baseline < 1 || baseline > 99) {
    return { ok: false, error: "Objectif ou seuil invalide." };
  }
  const supabase = await createClient();
  const { data: worker } = await supabase
    .from("profiles").select("id").eq("id", userId).eq("role", "worker").maybeSingle();
  if (!worker) return { ok: false, error: "Le compte doit avoir le rôle Collaborateur." };
  const { error } = await supabase.from("payroll_worker_settings").upsert({
    user_id: userId,
    target_millimes: target,
    baseline_percent: baseline,
    active: formData.get("active") === "on",
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/payroll");
  return { ok: true };
}

export async function addPayrollBonusAction(formData: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const date = String(formData.get("bonus_date") ?? "");
  const amount = millimesFromForm(formData.get("amount_dt"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || amount <= 0 || reason.length < 3) {
    return { ok: false, error: "Date, montant et raison sont obligatoires." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_bonuses").insert({
    user_id: userId,
    bonus_date: date,
    amount_millimes: amount,
    reason,
    created_by: admin.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/payroll");
  return { ok: true };
}

export async function deletePayrollBonusAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_bonuses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/payroll");
  return { ok: true };
}

export async function savePayrollPaymentAction(formData: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const periodStart = String(formData.get("period_start") ?? "");
  const status = String(formData.get("status") ?? "calculated");
  if (!userId || !PERIOD.test(periodStart) || !["calculated", "paid"].includes(status)) {
    return { ok: false, error: "Période ou statut invalide." };
  }
  const today = toBusinessDateKey(new Date())!;
  const currentPeriod = `${today.slice(0, 7)}-01`;
  if (periodStart >= currentPeriod) {
    return { ok: false, error: "Le mois en cours ne peut pas être clôturé avant le 1er du mois suivant." };
  }
  const supabase = await createClient();
  const calculation = await loadPayrollPeriod(supabase, userId, periodStart, nextPeriod(periodStart));
  if (!calculation) return { ok: false, error: "Configuration salariale inactive." };
  const paidAt = status === "paid" ? new Date().toISOString() : null;
  const { error } = await supabase.from("payroll_payments").upsert({
    user_id: userId,
    period_start: periodStart,
    earned_millimes: calculation.earnedMillimes,
    payout_millimes: calculation.payoutMillimes,
    target_millimes: calculation.targetMillimes,
    output_points: calculation.points,
    status,
    breakdown: calculation.breakdown,
    note: String(formData.get("note") ?? "").trim() || null,
    paid_at: paidAt,
    recorded_by: admin.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,period_start" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/payroll");
  return { ok: true };
}
