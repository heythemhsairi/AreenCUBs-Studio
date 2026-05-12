import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { ServicesList } from "./services-list";

export default async function ServicesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select(
      "id, name_fr, name_en, description_fr, category, default_price_dt, default_unit, active",
    )
    .order("name_fr");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogue des services"
        subtitle="Modifiez les services proposés et leurs tarifs"
        action={
          <Link href="/dashboard/services/new">
            <Button>+ Nouveau service</Button>
          </Link>
        }
      />
      <ServicesList services={data ?? []} />
    </div>
  );
}
