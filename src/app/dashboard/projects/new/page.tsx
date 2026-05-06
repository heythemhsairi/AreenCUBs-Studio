import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "../project-form";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireWorkerOrAdmin();
  const { clientId } = await searchParams;

  const supabase = await createClient();
  const [{ data: clients }, { data: members }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("id, username, full_name, role")
      .in("role", ["admin", "worker"])
      .order("full_name"),
  ]);

  return (
    <ProjectForm
      mode="create"
      defaultClientId={clientId}
      clients={clients ?? []}
      potentialOwners={members ?? []}
    />
  );
}
