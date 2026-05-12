import { createClient } from "@/lib/supabase/server";

export type AppSettings = {
  company_name: string;
  company_address: string;
  matricule_fiscal: string;
  email: string;
  phone: string;
  website: string;
  tva_rate: number;
  default_devis_object: string;
  default_facture_object: string;
};

const FALLBACK: AppSettings = {
  company_name: "Areen CUBs",
  company_address:
    "Résidence Nadine, Avenue Habib Bourguiba Ksibet El Médiouni Monastir 5031 Tunisie",
  matricule_fiscal: "1823660/R/M/A/000",
  email: "areencubs@gmail.com",
  phone: "+216 52 148 184",
  website: "areencubs.com",
  tva_rate: 19,
  default_devis_object:
    "Création d'identité visuelle et supports de communication",
  default_facture_object: "Facturation services rendus",
};

/** Server-only. Reads the singleton settings row, with a safe fallback. */
export async function getSettings(): Promise<AppSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("settings")
      .select(
        "company_name, company_address, matricule_fiscal, email, phone, website, tva_rate, default_devis_object, default_facture_object",
      )
      .eq("id", 1)
      .maybeSingle();
    if (!data) return FALLBACK;
    return {
      ...FALLBACK,
      ...data,
      tva_rate: Number(data.tva_rate ?? FALLBACK.tva_rate),
    };
  } catch (err) {
    console.error("[settings] read failed", err);
    return FALLBACK;
  }
}
