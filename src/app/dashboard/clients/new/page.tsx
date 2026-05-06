import { requireWorkerOrAdmin } from "@/lib/auth";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  await requireWorkerOrAdmin();
  return <ClientForm mode="create" />;
}
