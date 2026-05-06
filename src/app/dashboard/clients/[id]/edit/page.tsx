import { notFound } from "next/navigation";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientForm } from "../../client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireWorkerOrAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, address, matricule_fiscal, email, phone, notes")
    .eq("id", id)
    .single();
  if (!client) notFound();

  return <ClientForm mode="edit" client={client} />;
}
