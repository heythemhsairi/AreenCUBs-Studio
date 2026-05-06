"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const TVA_RATE = 19.0;

const DEVIS_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
const KINDS = ["devis", "facture"] as const;
type DevisStatus = (typeof DEVIS_STATUSES)[number];
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type DevisKind = (typeof KINDS)[number];

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
  kind: DevisKind;
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
  const rawKind = String(formData.get("kind") ?? "devis");
  const kind: DevisKind = KINDS.includes(rawKind as DevisKind)
    ? (rawKind as DevisKind)
    : "devis";
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
    kind,
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

async function nextNumber(kind: DevisKind): Promise<number> {
  // The default for devis_number is nextval('devis_number_seq'); for factures
  // we need to draw from facture_number_seq instead. We use the admin client
  // and an RPC-less SELECT to pull the next value.
  const admin = createAdminClient();
  const seq = kind === "facture" ? "facture_number_seq" : "devis_number_seq";
  const { data, error } = await admin
    .schema("public")
    .rpc("nextval_seq", { seq_name: seq })
    .single();
  if (!error && typeof data === "number") return data;
  // Fallback: read max+1 (best-effort if the RPC isn't installed).
  const { data: row } = await admin
    .from("devis")
    .select("devis_number")
    .eq("kind", kind)
    .order("devis_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((row?.devis_number as number | undefined) ?? (kind === "facture" ? 0 : 36)) + 1;
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

  // Get the right sequence number based on kind.
  const number = await nextNumber(input.kind);

  const { data: devis, error } = await supabase
    .from("devis")
    .insert({
      kind: input.kind,
      devis_number: number,
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
    .select("id, kind")
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

  const baseUrl =
    devis.kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";
  revalidatePath(baseUrl);
  redirect(`${baseUrl}/${devis.id}`);
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
  revalidatePath("/dashboard/factures");
  revalidatePath(`/dashboard/devis/${id}`);
  revalidatePath(`/dashboard/factures/${id}`);
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
  revalidatePath("/dashboard/factures");
  revalidatePath(`/dashboard/devis/${id}`);
  revalidatePath(`/dashboard/factures/${id}`);
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

  if (!devisId) return { ok: false, error: "Document manquant." };
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

  await recomputePaymentStatus(supabase, devisId);

  revalidatePath(`/dashboard/devis/${devisId}`);
  revalidatePath(`/dashboard/factures/${devisId}`);
  revalidatePath("/dashboard/devis");
  revalidatePath("/dashboard/factures");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/finance");
  return { ok: true };
}

// Quick "mark as paid in full" — records a payment for whatever's outstanding
// and flips payment_status to 'paid'.
export async function markFullyPaidAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const devisId = String(formData.get("devis_id") ?? "");
  if (!devisId) return { ok: false, error: "Document manquant." };

  const supabase = await createClient();
  const { data: devis } = await supabase
    .from("devis")
    .select("total_dt")
    .eq("id", devisId)
    .single();
  const { data: prevPayments } = await supabase
    .from("payments")
    .select("amount_dt")
    .eq("devis_id", devisId);
  const paidSum = (prevPayments ?? []).reduce(
    (s, p) => s + Number(p.amount_dt ?? 0),
    0,
  );
  const total = Number(devis?.total_dt ?? 0);
  const remaining = +(total - paidSum).toFixed(2);
  if (remaining > 0.01) {
    const { error } = await supabase.from("payments").insert({
      devis_id: devisId,
      amount_dt: remaining,
      paid_at: new Date().toISOString().slice(0, 10),
      method: "Solde marqué payé",
      recorded_by: session.id,
    });
    if (error) return { ok: false, error: error.message };
  }
  await recomputePaymentStatus(supabase, devisId);
  revalidatePath(`/dashboard/devis/${devisId}`);
  revalidatePath(`/dashboard/factures/${devisId}`);
  revalidatePath("/dashboard/devis");
  revalidatePath("/dashboard/factures");
  revalidatePath("/dashboard/finance");
  return { ok: true };
}

async function recomputePaymentStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  devisId: string,
) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, p: any) => s + Number(p.amount_dt ?? 0),
    0,
  );
  const total = Number(devis?.total_dt ?? 0);
  const paymentStatus: PaymentStatus =
    paidSum <= 0 ? "unpaid" : paidSum + 0.001 < total ? "partial" : "paid";
  await supabase
    .from("devis")
    .update({ payment_status: paymentStatus })
    .eq("id", devisId);
}

export async function deleteDevisAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "devis") as DevisKind;
  if (!id) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase.from("devis").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/devis");
  revalidatePath("/dashboard/factures");
  redirect(kind === "facture" ? "/dashboard/factures" : "/dashboard/devis");
}
