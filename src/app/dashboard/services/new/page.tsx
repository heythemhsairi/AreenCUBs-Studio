import { requireAdmin } from "@/lib/auth";
import { ServiceForm } from "../service-form";

export default async function NewServicePage() {
  await requireAdmin();
  return <ServiceForm mode="create" />;
}
