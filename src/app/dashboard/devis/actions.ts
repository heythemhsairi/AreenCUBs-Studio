"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const TVA_RATE = 19.0;

const DEVIS_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
type DevisStatus = (typeof DEVIS_STATUSES)[number];
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

type DevisItemInput = {
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price_dt: number;
  is_bonus: boolean;
};

type DevisInput = {
  client_id: string;
  date: string;
  due_date: string;
  object: string | null;
  notes: string | null;
  items: DevisItemInput[];
};

function parseItems(formData: FormData): DevisItemInput[] {
  const raw = formData.get("items_json");
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as DevisItemInput[];
    return parsed
      .filter((it) => (it.description ?? "").trim().length > 0)
      .map((it) => ({
        service_id: it.service_id || null,
        description: String(it.description).trim(),
        quantity: Math.max(0, Number(it.quantity) || 0),
        unit_price_dt: it.is_bonus ? 0 : Math.max(0, Number(it.unit_price_dt) || 0),
        is_bonus: Boolean(it.is_bonus),
      }));
  } catch {
    return [];
  }
}

function pickDevisInput(formData: FormData): DevisInput {
  return {
    client_id: String(formData.get("client_id") ?? ""),
    date: String(formData.get("date") ?? new Date().toISOString().slice(0, 10)),
    due_date: String(
      formData.get("due_date") ??
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
    ),
    object: stringOrNull(formData.get("object")),
    notes: stringOrNull(formData.get("notes")),
    items: parseItems(formData),
  };
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function computeTotals(items: DevisItemInput[]) {
  const subtotal = items.reduce(
    (sum, it) => sum + it.quantity * it.unit_price_dt,
    0,
  );
  const tva = +((subtotal * TVA_RATE) / 100).toFixed(2);
  const total = +(subtotal + tva).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), tva, total };
}

export async function createDevisAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const input = pickDevisInput(formData);

  if (!input.client_id) return { ok: false, error: "Client requis." };
  if (input.items.length === 0)
    return { ok: false, error: "Ajoutez au moins une ligne." };

  const totals = computeTotals(input.items);
  const supabase = await createClient();

  const { data: devis, error } = await supabase
    .from("devis")
    .insert({
      client_id: input.client_id,
      date: input.date,
      due_date: input.due_date,
      object: input.object,
      notes: input.notes,
      subtotal_dt: totals.subtotal,
      tva_rate: TVA_RATE,
      tva_dt: totals.tva,
      total_dt: totals.total,
      created_by: session.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: itemsError } = await supabase.from("devis_items").insert(
    input.items.map((it, idx) => ({
      devis_id: devis.id,
      service_id: it.service_id,
      description: it.description,
      quantity: it.quantity,
      unit_price_dt: it.unit_price_dt,
      line_total_dt: +(it.quantity * it.unit_price_dt).toFixed(2),
      position: idx,
      is_bonus: it.is_bonus,
    })),
  );
  if (itemsError) {
    await supabase.from("devis").delete().eq("id", devis.id);
    return { ok: false, error: itemsError.message };
  }

  revalidatePath("/dashboard/devis");
  redirect(`/dashboard/devis/${devis.id}`);
}

export async function updateDevisAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const input = pickDevisInput(formData);
  if (!input.client_id) return { ok: false, error: "Client requis." };
  if (input.items.length === 0)
    return { ok: false, error: "Ajoutez au moins une ligne." };

  const totals = computeTotals(input.items);
  const supabase = await createClient();

  const { error } = await supabase
    .from("devis")
    .update({
      client_id: input.client_id,
      date: input.date,
      due_date: input.due_date,
      object: input.object,
      notes: input.notes,
      subtotal_dt: totals.subtotal,
      tva_rate: TVA_RATE,
      tva_dt: totals.tva,
      total_dt: totals.total,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Replace items wholesale (simpler than diff)
  await supabase.from("devis_items").delete().eq("devis_id", id);
  const { error: itemsError } = await supabase.from("devis_items").insert(
    input.items.map((it, idx) => ({
      devis_id: id,
      service_id: it.service_id,
      description: it.description,
      quantity: it.quantity,
      unit_price_dt: it.unit_price_dt,
      line_total_dt: +(it.quantity * it.unit_price_dt).toFixed(2),
      position: idx,
      is_bonus: it.is_bonus,
    })),
  );
  if (itemsError) return { ok: false, error: itemsError.message };

  revalidatePath("/dashboard/devis");
  revalidatePath(`/dashboard/devis/${id}`);
  return { ok: true };
}

export async function setDevisStatusAction(
  id: string,
  status: DevisStatus,
): Promise<ActionResult> {
  await requireAdmin();
  if (!DEVIS_STATUSES.includes(status))
    return { ok: false, error: "Statut invalide." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("devis")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/devis");
  revalidatePath(`/dashboard/devis/${id}`);
  return { ok: true };
}

export async function recordPaymentAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const devisId = String(formData.get("devis_id") ?? "");
  const amount = Number(formData.get("amount_dt") ?? 0);
  const paidAt = String(
    formData.get("paid_at") ?? new Date().toISOString().slice(0, 10),
  );
  const method = stringOrNull(formData.get("method"));
  const notes = stringOrNull(formData.get("notes"));

  if (!devisId) return { ok: false, error: "Devis manquant." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "Montant invalide." };

  const supabase = await createClient();
  const { error: payErr } = await supabase.from("payments").insert({
    devis_id: devisId,
    amount_dt: amount,
    paid_at: paidAt,
    method,
    notes,
    recorded_by: session.id,
  });
  if (payErr) return { ok: false, error: payErr.message };

  // Recompute payment_status from sum(payments) vs total_dt
  const { data: devis } = await supabase
    .from("devis")
    .select("total_dt")
    .eq("id", devisId)
    .single();
  const { data: payments } = await supabase
    .from("payments")
    .select("amount_dt")
    .eq("devis_id", devisId);
  const paidSum = (payments ?? []).reduce(
    (s, p) => s + Number(p.amount_dt ?? 0),
    0,
  );
  const total = Number(devis?.total_dt ?? 0);
  const paymentStatus: PaymentStatus =
    paidSum <= 0 ? "unpaid" : paidSum + 0.001 < total ? "partial" : "paid";

  await supabase
    .from("devis")
    .update({ payment_status: paymentStatus })
    .eq("id", devisId);

  revalidatePath(`/dashboard/devis/${devisId}`);
  revalidatePath("/dashboard/devis");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteDevisAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase.from("devis").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/devis");
  redirect("/dashboard/devis");
}
