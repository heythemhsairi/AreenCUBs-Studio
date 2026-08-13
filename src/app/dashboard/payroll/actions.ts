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

function taskTypeValues(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const baseRateMillimes = millimesFromForm(formData.get("base_rate_dt"));
  const aboveRateMillimes = millimesFromForm(formData.get("above_rate_dt"));
  const outputPoints = Number(formData.get("output_points"));
  if (!label || baseRateMillimes <= 0 || aboveRateMillimes <= 0 || !Number.isInteger(outputPoints) || outputPoints < 0) {
    return null;
  }
  return { label, baseRateMillimes, aboveRateMillimes, outputPoints };
}

function taskTypeCode(label: string) {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36) || "type";
  return `${base}_${crypto.randomUUID().slice(0, 8)}`;
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
  const values = taskTypeValues(formData);
  if (!id || !values) {
    return { ok: false, error: "Tarif ou points invalides." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_task_types").update({
    label: values.label,
    base_rate_millimes: values.baseRateMillimes,
    above_rate_millimes: values.aboveRateMillimes,
    output_points: values.outputPoints,
    active: formData.get("active") === "on",
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/payroll");
  return { ok: true };
}

export async function createPayrollTaskTypeAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const values = taskTypeValues(formData);
  if (!values) return { ok: false, error: "Tarif ou points invalides." };

  const supabase = await createClient();
  const { data: lastType, error: positionError } = await supabase
    .from("payroll_task_types")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) return { ok: false, error: positionError.message };

  const { error } = await supabase.from("payroll_task_types").insert({
    code: taskTypeCode(values.label),
    label: values.label,
    base_rate_millimes: values.baseRateMillimes,
    above_rate_millimes: values.aboveRateMillimes,
    output_points: values.outputPoints,
    active: true,
    position: (lastType?.position ?? 0) + 10,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/payroll");
  return { ok: true };
}

export async function deletePayrollTaskTypeAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Type de tâche introuvable." };

  const supabase = await createClient();
  const [tasks, credits] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("payroll_task_type_id", id),
    supabase.from("payroll_task_credits").select("id", { count: "exact", head: true }).eq("task_type_id", id),
  ]);
  if (tasks.error || credits.error) {
    return { ok: false, error: tasks.error?.message ?? credits.error?.message ?? "Vérification impossible." };
  }
  if ((tasks.count ?? 0) > 0 || (credits.count ?? 0) > 0) {
    return { ok: false, error: "Ce type est déjà lié à une tâche ou à l'historique. Désactivez-le au lieu de le supprimer." };
  }

  const { data, error } = await supabase.from("payroll_task_types").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Type de tâche introuvable." };
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
