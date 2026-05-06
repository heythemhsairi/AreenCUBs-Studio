import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamEditClient } from "./edit-client";
import type { UserRole } from "@/lib/utils";

export default async function TeamEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;

  const admin = createAdminClient();
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, full_name, role, avatar_url")
      .eq("id", id)
      .single(),
    admin.auth.admin.getUserById(id),
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
        email: authUser.user?.email ?? "",
      }}
      isSelf={profile.id === session.id}
    />
  );
}
