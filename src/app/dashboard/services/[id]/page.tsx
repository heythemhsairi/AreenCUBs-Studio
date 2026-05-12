import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ServiceForm } from "../service-form";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select(
      "id, name_fr, name_en, description_fr, category, default_price_dt, default_unit, active",
    )
    .eq("id", id)
    .single();
  if (!data) notFound();
  return <ServiceForm mode="edit" service={data} />;
}
