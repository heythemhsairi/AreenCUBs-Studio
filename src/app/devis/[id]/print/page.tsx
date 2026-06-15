import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { DevisPrintView } from "./print-view";

export const metadata = {
  title: "Devis — Areen CUBs",
};

export default async function DevisPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: devis }, settings] = await Promise.all([
    supabase
      .from("devis")
      .select(
        "id, kind, devis_number, date, due_date, object, subtotal_dt, tva_dt, tva_rate, total_dt, discount_dt, clients:client_id(id, name, address, matricule_fiscal), devis_items(id, description, quantity, unit_price_dt, line_total_dt, is_bonus, position)",
      )
      .eq("id", id)
      .single(),
    getSettings(),
  ]);

  if (!devis) notFound();

  const client = Array.isArray(devis.clients) ? devis.clients[0] : devis.clients;
  const items = (devis.devis_items ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <DevisPrintView
      settings={settings}
      devis={{
        kind: (devis.kind as "devis" | "facture") ?? "devis",
        devis_number: devis.devis_number,
        date: devis.date,
        due_date: devis.due_date,
        object: devis.object,
        subtotal_dt: Number(devis.subtotal_dt),
        discount_dt: Number(devis.discount_dt ?? 0),
        tva_dt: Number(devis.tva_dt),
        tva_rate: Number(devis.tva_rate),
        total_dt: Number(devis.total_dt),
      }}
      client={
        client
          ? {
              name: client.name,
              address: client.address,
              matricule_fiscal: client.matricule_fiscal,
            }
          : null
      }
      items={items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit_price_dt: Number(it.unit_price_dt),
        line_total_dt: Number(it.line_total_dt),
        is_bonus: it.is_bonus,
      }))}
    />
  );
}
