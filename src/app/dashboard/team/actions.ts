"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, createAdminClientOrNull } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail, type UserRole } from "@/lib/utils";
import { TEAM_ROLES } from "@/lib/roles";

// The roles an administrator may assign through the team form. TEAM_ROLES,
// not every role: a `client` account is a contact at a client organisation and
// needs a client_members row to mean anything, which this form does not
// collect. Creating one here would produce an account that can sign in and
// reach nothing — a support ticket, not a permission.
const VALID_ROLES: UserRole[] = TEAM_ROLES;

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
  const jobTitleRaw = String(formData.get("job_title") ?? "").trim();
  const jobTitle = jobTitleRaw.length > 0 ? jobTitleRaw : null;

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

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    full_name: fullName,
    role,
    job_title: jobTitle,
  });
  if (profileErr) {
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
  const jobTitleRaw = String(formData.get("job_title") ?? "").trim();
  const jobTitle = jobTitleRaw.length > 0 ? jobTitleRaw : null;

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

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, full_name: fullName || null, job_title: jobTitle })
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
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/team");
  redirect("/dashboard/team");
}

export async function uploadAvatarAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const file = formData.get("avatar");

  if (!id) return { ok: false, error: "ID manquant." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Fichier manquant." };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: "Image trop grande (max 4 Mo)." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Le fichier doit être une image." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${id}/${Date.now()}.${ext}`;

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(path);

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", id);
  if (profileErr) return { ok: false, error: profileErr.message };

  revalidatePath("/dashboard/team");
  revalidatePath(`/dashboard/team/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeAvatarAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/team");
  revalidatePath(`/dashboard/team/${id}`);
  return { ok: true };
}

export async function setFeaturedEmployeeAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const month = String(formData.get("month") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!userId || !/^\d{4}-\d{2}$/.test(month)) {
    return { ok: false, error: "Membre ou mois invalide." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("featured_employees")
    .upsert(
      {
        user_id: userId,
        month,
        reason,
        created_by: session.id,
      },
      { onConflict: "month" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/team/featured");
  return { ok: true };
}

export async function clearFeaturedEmployeeAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const month = String(formData.get("month") ?? "");
  if (!month) return { ok: false, error: "Mois manquant." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("featured_employees")
    .delete()
    .eq("month", month);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team/featured");
  return { ok: true };
}

export async function listTeamMembers() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, avatar_url, job_title, created_at")
    // Staff only. A client organisation's contact holds a profiles row too, so
    // an unfiltered listing would place an external person in the agency's own
    // team directory — and hand their name to every other client contact the
    // moment the portal exists.
    .in("role", TEAM_ROLES)
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Email lives in auth.users and is reachable only through the Auth admin
  // API. It is one column of a directory that is otherwise fully readable
  // through RLS, so its absence must not cost the page: without the guard the
  // constructor threw during the server render and /dashboard/team returned a
  // 500 with the message suppressed by the production build.
  //
  // That 500 is what three sessions recorded as a "hydration defect". It was
  // never a hydration mismatch — the server component itself was throwing, and
  // React's production error text ("An error occurred in the Server Components
  // render") reads enough like a client-side failure to send a diagnosis down
  // the wrong path.
  const admin = createAdminClientOrNull();
  let emailById = new Map<string, string>();
  if (admin) {
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
    emailById = new Map((usersList?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  } else {
    console.warn(
      "[team] SUPABASE_SERVICE_ROLE_KEY absent — member emails omitted from the directory.",
    );
  }

  return (profiles ?? []).map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? "",
  }));
}
