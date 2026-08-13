import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TeamEditClient } from "./edit-client";
import type { UserRole } from "@/lib/utils";

export default async function TeamEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const admin = createAdminClientOrNull();
  const [{ data: profile }, authResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, full_name, role, avatar_url, job_title")
      .eq("id", id)
      .single(),
    admin ? admin.auth.admin.getUserById(id) : Promise.resolve(null),
  ]);

  if (!profile) notFound();

  return (
    <TeamEditClient
      member={{
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        role: profile.role as UserRole,
        avatar_url: profile.avatar_url,
        job_title: profile.job_title ?? null,
        email: authResult?.data.user?.email ?? "",
      }}
      isSelf={profile.id === session.id}
    />
  );
}
