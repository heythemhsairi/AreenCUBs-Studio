"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail, type UserRole } from "@/lib/utils";

const VALID_ROLES: UserRole[] = ["admin", "worker", "freelancer"];

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createTeamMemberAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0];
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;

  if (!username || !fullName || !password) {
    return { ok: false, error: "Tous les champs obligatoires." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Mot de passe minimum 8 caractères." };
  }
  if (!VALID_ROLES.includes(role)) {
    return { ok: false, error: "Rôle invalide." };
  }

  const admin = createAdminClient();
  const email = usernameToEmail(username);

  // 1) Create auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  });
  if (createErr || !created.user) {
    return {
      ok: false,
      error: createErr?.message ?? "Échec de création de l'utilisateur.",
    };
  }

  // 2) Insert profile row
  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    full_name: fullName,
    role,
  });
  if (profileErr) {
    // Roll back the auth user so we don't leave an orphan
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: profileErr.message };
  }

  revalidatePath("/dashboard/team");
  redirect("/dashboard/team");
}

export async function updateTeamMemberAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!id) return { ok: false, error: "ID manquant." };
  if (!VALID_ROLES.includes(role)) {
    return { ok: false, error: "Rôle invalide." };
  }
  if (id === session.id && role !== "admin") {
    return {
      ok: false,
      error: "Vous ne pouvez pas changer votre propre rôle.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role, full_name: fullName || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/team");
  revalidatePath(`/dashboard/team/${id}`);
  return { ok: true };
}

export async function resetTeamMemberPasswordAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!id) return { ok: false, error: "ID manquant." };
  if (password.length < 8) {
    return { ok: false, error: "Mot de passe minimum 8 caractères." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export async function deleteTeamMemberAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };
  if (id === session.id) {
    return {
      ok: false,
      error: "Vous ne pouvez pas supprimer votre propre compte.",
    };
  }

  const admin = createAdminClient();
  // Profile cascade-deletes via FK; deleting the auth user removes both.
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/team");
  redirect("/dashboard/team");
}

// Internal helper: list users with their auth emails (admin only).
export async function listTeamMembers() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Get emails from auth admin (only admins call this)
  const admin = createAdminClient();
  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const emailById = new Map(
    (usersList?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  return (profiles ?? []).map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? "",
  }));
}
