import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DevisBuilder } from "../../devis-builder";

export default async function EditDevisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: devis }, { data: clients }, { data: services }] =
    await Promise.all([
      supabase
        .from("devis")
        .select(
          "id, client_id, date, due_date, object, notes, devis_items(service_id, description, quantity, unit_price_dt, is_bonus, position)",
        )
        .eq("id", id)
        .single(),
      supabase.from("clients").select("id, name").order("name"),
      supabase
        .from("services")
        .select("id, name_fr, default_price_dt, default_unit, category")
        .eq("active", true)
        .order("name_fr"),
    ]);

  if (!devis) notFound();

  const items = (devis.devis_items ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((it) => ({
      service_id: it.service_id,
      description: it.description,
      quantity: Number(it.quantity),
      unit_price_dt: Number(it.unit_price_dt),
      is_bonus: it.is_bonus,
    }));

  return (
    <DevisBuilder
      mode="edit"
      devis={{
        id: devis.id,
        client_id: devis.client_id,
        date: devis.date,
        due_date: devis.due_date,
        object: devis.object,
        notes: devis.notes,
        items,
      }}
      clients={clients ?? []}
      services={services ?? []}
    />
  );
}
