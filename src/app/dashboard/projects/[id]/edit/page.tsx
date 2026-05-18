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

  const [{ data: project }, { data: members }, { data: pa }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, client_id, name, description, status, owner_id, start_date, end_date",
        )
        .eq("id", id)
        .single(),
      supabase
        .from("profiles")
        .select("id, username, full_name, role, avatar_url")
        .order("full_name"),
      supabase
        .from("project_assignees")
        .select("user_id")
        .eq("project_id", id),
    ]);

  if (!project) notFound();

  const assigneeIds = ((pa as { user_id: string }[] | null) ?? []).map(
    (r) => r.user_id,
  );

  return (
    <ProjectForm
      mode="edit"
      project={{ ...project, assignee_ids: assigneeIds }}
      potentialOwners={members ?? []}
    />
  );
}
