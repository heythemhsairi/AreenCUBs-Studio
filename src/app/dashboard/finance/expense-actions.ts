"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ExpenseResult = { ok: true } | { ok: false; error: string };

export const EXPENSE_CATEGORIES = [
  { value: "salaries",    label: "Salaires" },
  { value: "freelancers", label: "Freelances" },
  { value: "ads",         label: "Publicité" },
  { value: "software",    label: "Logiciels" },
  { value: "hosting",     label: "Hébergement" },
  { value: "transport",   label: "Transport" },
  { value: "office",      label: "Bureau" },
  { value: "production",  label: "Production client" },
  { value: "other",       label: "Autre" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];

export async function addExpenseAction(
  formData: FormData,
): Promise<ExpenseResult> {
  const session = await requireAdmin();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "other");
  const amount = Number(formData.get("amount_dt") ?? 0);
  const expense_date = String(
    formData.get("expense_date") ?? new Date().toISOString().slice(0, 10),
  );
  const project_id = stringOrNull(formData.get("project_id"));
  const client_id = stringOrNull(formData.get("client_id"));
  const vendor = stringOrNull(formData.get("vendor"));
  const payment_method = stringOrNull(formData.get("payment_method"));
  const receipt_url = stringOrNull(formData.get("receipt_url"));
  const notes = stringOrNull(formData.get("notes"));

  if (!title) return { ok: false, error: "Titre requis." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "Montant invalide." };

  const { error } = await supabase.from("expenses").insert({
    title,
    category,
    amount_dt: amount,
    expense_date,
    project_id,
    client_id,
    vendor,
    payment_method,
    receipt_url,
    notes,
    created_by: session.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/finance");
  return { ok: true };
}

export async function deleteExpenseAction(
  expenseId: string,
): Promise<ExpenseResult> {
  await requireAdmin();
  if (!expenseId) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/finance");
  return { ok: true };
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
