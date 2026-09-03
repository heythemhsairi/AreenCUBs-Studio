"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireClientAccess, requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/utils";

export type ActionResult = { ok: true } | { ok: false; error: string };

function pickClientFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    address: stringOrNull(formData.get("address")),
    matricule_fiscal: stringOrNull(formData.get("matricule_fiscal")),
    email: stringOrNull(formData.get("email")),
    phone: stringOrNull(formData.get("phone")),
    notes: stringOrNull(formData.get("notes")),
  };
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function createClientAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireClientAccess();
  const fields = pickClientFields(formData);
  if (!fields.name) return { ok: false, error: "Le nom est requis." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...fields, created_by: session.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${data.id}`);
}

export async function updateClientAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireClientAccess();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const fields = pickClientFields(formData);
  if (!fields.name) return { ok: false, error: "Le nom est requis." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  return { ok: true };
}

export async function deleteClientAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

export async function createClientContactAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const clientId = String(formData.get("client_id") ?? "");
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0];
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!clientId || !username || !fullName || !password) {
    return { ok: false, error: "Tous les champs sont obligatoires." };
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return {
      ok: false,
      error: "Le nom d’utilisateur accepte uniquement lettres, chiffres, points, tirets et underscores.",
    };
  }
  if (password.length < 8) {
    return { ok: false, error: "Mot de passe minimum 8 caractères." };
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { ok: false, error: "Client introuvable." };

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  });
  if (createErr || !created.user) {
    return {
      ok: false,
      error: createErr?.message ?? "Échec de création du compte client.",
    };
  }

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    full_name: fullName,
    role: "client",
    job_title: "Client",
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: profileErr.message };
  }

  const { error: membershipErr } = await admin.from("client_members").insert({
    client_id: clientId,
    profile_id: created.user.id,
    relation: "client_contact",
    created_by: session.id,
  });
  if (membershipErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: membershipErr.message };
  }

  const { error: auditErr } = await admin.from("audit_log").insert({
    actor_id: session.id,
    actor_role: session.role,
    action: "client_contact.created",
    entity_type: "profile",
    entity_id: created.user.id,
    summary: `${fullName} (@${username})`,
  });
  if (auditErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: auditErr.message };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ok: true };
}
