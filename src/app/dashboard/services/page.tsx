import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ServicesList } from "./services-list";

export default async function ServicesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select(
      "id, name_fr, name_en, description_fr, description_en, category, default_price_dt, default_unit, active",
    )
    .order("name_fr");

  return <ServicesList services={data ?? []} />;
}
