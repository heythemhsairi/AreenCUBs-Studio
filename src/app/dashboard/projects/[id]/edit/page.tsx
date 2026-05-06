import { notFound } from "next/navigation";
import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "../../project-form";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireWorkerOrAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: members }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, client_id, name, description, status, owner_id, start_date, end_date",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("id, username, full_name, role")
      .in("role", ["admin", "worker"])
      .order("full_name"),
  ]);

  if (!project) notFound();

  return (
    <ProjectForm
      mode="edit"
      project={project}
      potentialOwners={members ?? []}
    />
  );
}
