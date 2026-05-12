"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateSettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const companyName = String(formData.get("company_name") ?? "").trim();
  const companyAddress = String(formData.get("company_address") ?? "").trim();
  const matriculeFiscal = String(formData.get("matricule_fiscal") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const tvaRate = Number(formData.get("tva_rate") ?? 19);
  const defaultDevisObject = String(
    formData.get("default_devis_object") ?? "",
  ).trim();
  const defaultFactureObject = String(
    formData.get("default_facture_object") ?? "",
  ).trim();

  if (!companyName) return { ok: false, error: "Nom d'entreprise requis." };
  if (!Number.isFinite(tvaRate) || tvaRate < 0 || tvaRate > 100) {
    return { ok: false, error: "TVA invalide (0-100)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      company_name: companyName,
      company_address: companyAddress,
      matricule_fiscal: matriculeFiscal,
      email,
      phone,
      website,
      tva_rate: tvaRate,
      default_devis_object: defaultDevisObject,
      default_facture_object: defaultFactureObject,
    })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/devis");
  revalidatePath("/dashboard/factures");
  return { ok: true };
}
