import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DevisBuilder } from "../../devis/devis-builder";

export default async function NewFacturePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireAdmin();
  const { clientId } = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: services }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("services")
      .select("id, name_fr, default_price_dt, default_unit, category")
      .eq("active", true)
      .order("name_fr"),
  ]);

  return (
    <DevisBuilder
      mode="create"
      kind="facture"
      defaultClientId={clientId}
      clients={clients ?? []}
      services={services ?? []}
    />
  );
}
