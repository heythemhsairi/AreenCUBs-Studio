import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DevisDetailClient } from "./devis-detail-client";

export default async function DevisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: devis } = await supabase
    .from("devis")
    .select(
      "id, kind, devis_number, date, due_date, object, notes, status, payment_status, subtotal_dt, discount_dt, tva_dt, tva_rate, stamp_dt, total_dt, parent_devis_id, clients:client_id(id, name, address, matricule_fiscal), devis_items(id, description, quantity, unit_price_dt, line_total_dt, is_bonus, position)",
    )
    .eq("id", id)
    .single();
  if (!devis) notFound();

  let parent: { id: string; devis_number: number; kind: string } | null = null;
  if (devis.parent_devis_id) {
    const { data: p } = await supabase
      .from("devis")
      .select("id, devis_number, kind")
      .eq("id", devis.parent_devis_id)
      .maybeSingle();
    parent = p;
  }

  let derivedFacture: { id: string; devis_number: number } | null = null;
  if (devis.kind === "devis") {
    const { data: f } = await supabase
      .from("devis")
      .select("id, devis_number")
      .eq("parent_devis_id", id)
      .eq("kind", "facture")
      .maybeSingle();
    derivedFacture = f;
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount_dt, paid_at, method, notes")
    .eq("devis_id", id)
    .order("paid_at", { ascending: false });

  const client = Array.isArray(devis.clients) ? devis.clients[0] : devis.clients;
  const items = (devis.devis_items ?? []).slice().sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const paidSum = (payments ?? []).reduce((s, p) => s + Number(p.amount_dt ?? 0), 0);

  return (
    <DevisDetailClient
      id={devis.id}
      kind={(devis.kind as "devis" | "facture") ?? "devis"}
      devisNumber={devis.devis_number}
      date={devis.date}
      dueDate={devis.due_date ?? null}
      status={devis.status}
      paymentStatus={devis.payment_status}
      subtotalDt={Number(devis.subtotal_dt)}
      discountDt={Number(devis.discount_dt ?? 0)}
      tvaDt={Number(devis.tva_dt)}
      tvaRate={Number(devis.tva_rate)}
      stampDt={Number(devis.stamp_dt ?? 0)}
      totalDt={Number(devis.total_dt)}
      clientName={client?.name ?? null}
      items={items.map((it) => ({
        id: it.id,
        description: it.description ?? null,
        quantity: it.quantity,
        unit_price_dt: Number(it.unit_price_dt),
        line_total_dt: Number(it.line_total_dt),
        is_bonus: it.is_bonus ?? false,
        position: it.position ?? null,
      }))}
      payments={(payments ?? []).map((p) => ({
        id: p.id,
        amount_dt: Number(p.amount_dt),
        paid_at: p.paid_at,
        method: p.method ?? null,
        notes: p.notes ?? null,
      }))}
      paidSum={paidSum}
      parent={parent}
      derivedFacture={derivedFacture}
    />
  );
}
