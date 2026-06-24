"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyMany } from "@/lib/notify";

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
  discount_dt: number;
  /** Optional manual override of the document number. */
  devis_number: number | null;
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
    discount_dt: Math.max(0, Number(formData.get("discount_dt") ?? 0) || 0),
    devis_number: parseDevisNumber(formData.get("devis_number")),
  };
}

/** Manual document number: positive integer, or null to auto-assign. */
function parseDevisNumber(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (s.length === 0) return null;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function computeTotals(items: DevisItemInput[], discountDt = 0) {
  const subtotal = items.reduce(
    (sum, it) => sum + it.quantity * it.unit_price_dt,
    0,
  );
  const discount = Math.max(0, Math.min(subtotal, discountDt));
  const net = subtotal - discount;
  const tva = +((net * TVA_RATE) / 100).toFixed(2);
  const total = +(net + tva).toFixed(2);
  return {
    subtotal: +subtotal.toFixed(2),
    discount: +discount.toFixed(2),
    tva,
    total,
  };
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

/**
 * True if `number` is already used by another document of the same kind.
 * `excludeId` lets the edit form keep its own current number.
 */
async function numberTaken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  kind: DevisKind,
  number: number,
  excludeId: string | null,
): Promise<boolean> {
  let q = supabase
    .from("devis")
    .select("id")
    .eq("kind", kind)
    .eq("devis_number", number);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.limit(1).maybeSingle();
  return !!data;
}

export async function createDevisAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const input = pickDevisInput(formData);

  if (!input.client_id) return { ok: false, error: "Client requis." };
  if (input.items.length === 0)
    return { ok: false, error: "Ajoutez au moins une ligne." };

  const totals = computeTotals(input.items, input.discount_dt);
  const supabase = await createClient();

  // Manual number if the admin set one, otherwise the next in sequence.
  let number: number;
  if (input.devis_number !== null) {
    const taken = await numberTaken(
      supabase,
      input.kind,
      input.devis_number,
      null,
    );
    if (taken)
      return {
        ok: false,
        error: `Le numéro ${input.devis_number} est déjà utilisé.`,
      };
    number = input.devis_number;
  } else {
    number = await nextNumber(input.kind);
  }

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
      discount_dt: totals.discount,
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

  const totals = computeTotals(input.items, input.discount_dt);
  const supabase = await createClient();

  // Allow editing the document number; reject collisions with a
  // different document of the same kind.
  const numberPatch: { devis_number?: number } = {};
  if (input.devis_number !== null) {
    const { data: cur } = await supabase
      .from("devis")
      .select("kind, devis_number")
      .eq("id", id)
      .single();
    const kind = (cur?.kind as DevisKind) ?? input.kind;
    if (cur && cur.devis_number !== input.devis_number) {
      const taken = await numberTaken(
        supabase,
        kind,
        input.devis_number,
        id,
      );
      if (taken)
        return {
          ok: false,
          error: `Le numéro ${input.devis_number} est déjà utilisé.`,
        };
      numberPatch.devis_number = input.devis_number;
    }
  }

  const { error } = await supabase
    .from("devis")
    .update({
      client_id: input.client_id,
      date: input.date,
      due_date: input.due_date,
      object: input.object,
      notes: input.notes,
      subtotal_dt: totals.subtotal,
      discount_dt: totals.discount,
      tva_rate: TVA_RATE,
      tva_dt: totals.tva,
      total_dt: totals.total,
      ...numberPatch,
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
  const session = await requireAdmin();
  if (!DEVIS_STATUSES.includes(status))
    return { ok: false, error: "Statut invalide." };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("devis")
    .select(
      "status, kind, devis_number, clients:client_id(name)",
    )
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("devis")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Notify other admins when a devis flips to accepted or rejected — they
  // probably want to know without watching the table.
  if (
    before &&
    before.status !== status &&
    (status === "accepted" || status === "rejected")
  ) {
    const client = Array.isArray(before.clients)
      ? before.clients[0]
      : before.clients;
    const kindLabel = before.kind === "facture" ? "Facture" : "Devis";
    const statusLabel = status === "accepted" ? "accepté" : "refusé";
    const baseUrl =
      before.kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";
    await notifyOtherAdmins(
      session.id,
      `devis_${status}`,
      `${kindLabel} #${before.devis_number} ${statusLabel} — ${client?.name ?? "—"}`,
      `${baseUrl}/${id}`,
    );
  }

  revalidatePath("/dashboard/devis");
  revalidatePath("/dashboard/factures");
  revalidatePath(`/dashboard/devis/${id}`);
  revalidatePath(`/dashboard/factures/${id}`);
  return { ok: true };
}

async function notifyOtherAdmins(
  actorId: string,
  kind: string,
  body: string,
  link: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    const others = (data ?? [])
      .map((r) => r.id as string)
      .filter((id) => id !== actorId);
    await notifyMany(others, kind, body, link);
  } catch (err) {
    console.error("[notifyOtherAdmins]", err);
  }
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
    .select(
      "total_dt, kind, devis_number, payment_status, clients:client_id(name)",
    )
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

  // Notify other admins on transition unpaid/partial → paid.
  if (devis && devis.payment_status !== "paid") {
    const client = Array.isArray(devis.clients)
      ? devis.clients[0]
      : devis.clients;
    const kindLabel = devis.kind === "facture" ? "Facture" : "Devis";
    const baseUrl =
      devis.kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";
    await notifyOtherAdmins(
      session.id,
      "devis_paid",
      `${kindLabel} #${devis.devis_number} payée — ${client?.name ?? "—"} (${total.toFixed(2)} DT)`,
      `${baseUrl}/${devisId}`,
    );
  }

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

// Reset all payments → mark as unpaid. Used from the quick payment menu in
// the list view to "annuler les paiements" without going to the detail page.
export async function resetPaymentsAction(
  devisId: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!devisId) return { ok: false, error: "Document manquant." };

  const supabase = await createClient();
  const { error: delErr } = await supabase
    .from("payments")
    .delete()
    .eq("devis_id", devisId);
  if (delErr) return { ok: false, error: delErr.message };

  const { error: updErr } = await supabase
    .from("devis")
    .update({ payment_status: "unpaid" })
    .eq("id", devisId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/dashboard/devis/${devisId}`);
  revalidatePath(`/dashboard/factures/${devisId}`);
  revalidatePath("/dashboard/devis");
  revalidatePath("/dashboard/factures");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Convert a devis to a facture: copy header + items into a new row with
// kind='facture' and parent_devis_id pointing back to the source.
export async function convertDevisToFactureAction(
  devisId: string,
): Promise<{ ok: true; factureId: string } | { ok: false; error: string }> {
  const session = await requireAdmin();
  if (!devisId) return { ok: false, error: "Devis manquant." };

  const supabase = await createClient();

  const { data: source } = await supabase
    .from("devis")
    .select(
      "id, kind, client_id, object, notes, subtotal_dt, discount_dt, tva_rate, tva_dt, total_dt, devis_items(service_id, description, quantity, unit_price_dt, line_total_dt, position, is_bonus)",
    )
    .eq("id", devisId)
    .single();
  if (!source) return { ok: false, error: "Devis introuvable." };
  if (source.kind !== "devis")
    return { ok: false, error: "Seul un devis peut être converti." };

  // Avoid creating two factures for the same devis
  const { data: already } = await supabase
    .from("devis")
    .select("id")
    .eq("parent_devis_id", devisId)
    .eq("kind", "facture")
    .maybeSingle();
  if (already) {
    revalidatePath(`/dashboard/factures/${already.id}`);
    redirect(`/dashboard/factures/${already.id}`);
  }

  const number = await nextNumber("facture");
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: facture, error: insErr } = await supabase
    .from("devis")
    .insert({
      kind: "facture",
      devis_number: number,
      parent_devis_id: source.id,
      client_id: source.client_id,
      date: today,
      due_date: due,
      object: source.object,
      notes: source.notes,
      subtotal_dt: source.subtotal_dt,
      discount_dt: source.discount_dt ?? 0,
      tva_rate: source.tva_rate,
      tva_dt: source.tva_dt,
      total_dt: source.total_dt,
      created_by: session.id,
    })
    .select("id")
    .single();
  if (insErr || !facture)
    return { ok: false, error: insErr?.message ?? "Échec de la conversion." };

  const itemRows = (source.devis_items ?? []).map((it) => ({
    devis_id: facture.id,
    service_id: it.service_id,
    description: it.description,
    quantity: it.quantity,
    unit_price_dt: it.unit_price_dt,
    line_total_dt: it.line_total_dt,
    position: it.position ?? 0,
    is_bonus: it.is_bonus,
  }));
  if (itemRows.length > 0) {
    const { error: itemsErr } = await supabase
      .from("devis_items")
      .insert(itemRows);
    if (itemsErr) {
      await supabase.from("devis").delete().eq("id", facture.id);
      return { ok: false, error: itemsErr.message };
    }
  }

  // Transfer existing devis payments to the new facture.
  // Rule: once a facture exists for a devis, payments belong to the facture.
  const { data: devisPayments } = await supabase
    .from("payments")
    .select("id, amount_dt, paid_at, method, notes, recorded_by, created_at")
    .eq("devis_id", devisId);

  for (const pay of devisPayments ?? []) {
    // Dedup guard: skip if a copy already exists on this facture for this source payment
    const { data: exists } = await supabase
      .from("payments")
      .select("id")
      .eq("devis_id", facture.id)
      .eq("source_payment_id", pay.id)
      .maybeSingle();
    if (!exists) {
      await supabase.from("payments").insert({
        devis_id: facture.id,
        amount_dt: pay.amount_dt,
        paid_at: pay.paid_at,
        method: pay.method ?? "transféré depuis devis",
        notes: pay.notes,
        recorded_by: pay.recorded_by,
        source_devis_id: devisId,
        source_payment_id: pay.id,
        migrated_from_devis: true,
        created_at: pay.created_at,
      });
    }
  }

  // Mark original devis payments as superseded so the dashboard excludes them
  if ((devisPayments ?? []).length > 0) {
    await supabase
      .from("payments")
      .update({ source_devis_id: devisId })
      .eq("devis_id", devisId)
      .is("source_devis_id", null);
  }

  // Recompute facture payment_status from its now-linked payments
  const { data: paidRows } = await supabase
    .from("payments")
    .select("amount_dt")
    .eq("devis_id", facture.id);
  const totalPaid = (paidRows ?? []).reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);
  const totalDt   = Number(source.total_dt ?? 0);
  const newStatus =
    totalPaid <= 0 ? "unpaid"
    : totalPaid + 0.01 >= totalDt ? "paid"
    : "partial";
  await supabase
    .from("devis")
    .update({ payment_status: newStatus })
    .eq("id", facture.id);

  revalidatePath("/dashboard/devis");
  revalidatePath("/dashboard/factures");
  revalidatePath(`/dashboard/devis/${devisId}`);
  redirect(`/dashboard/factures/${facture.id}`);
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
