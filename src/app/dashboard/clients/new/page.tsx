import { requireClientAccess } from "@/lib/auth";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  await requireClientAccess();
  return <ClientForm mode="create" />;
}
