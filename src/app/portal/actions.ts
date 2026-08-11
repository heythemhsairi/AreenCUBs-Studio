"use server";

import { revalidatePath } from "next/cache";
import { requireClientContact } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PortalActionResult = { ok: true } | { ok: false; error: string };

/**
 * Records a client's decision on one content item.
 *
 * Everything that matters is checked in the database, by
 * `public.portal_set_approval`: that the caller holds the client role, that
 * the item belongs to an organisation they are a contact of, that it is
 * actually awaiting their review, and that the decision is one of two values.
 *
 * The guard here is real but it is the outer of two layers, not the only one.
 * If this file were bypassed entirely — a forged request straight to PostgREST
 * — the function would still refuse, because it re-derives membership from
 * auth.uid() rather than trusting anything the caller sends.
 *
 * `status` is not writable from here at any layer. A client records a
 * decision; moving an item through production remains the agency's.
 */
export async function setContentApprovalAction(
  formData: FormData,
): Promise<PortalActionResult> {
  await requireClientContact();

  const itemId = String(formData.get("item_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const feedbackRaw = String(formData.get("feedback") ?? "").trim();

  if (!itemId) return { ok: false, error: "Élément manquant." };
  if (decision !== "approved" && decision !== "revision_requested") {
    return { ok: false, error: "Décision invalide." };
  }
  // A revision request with no explanation is not actionable for the team, so
  // it is rejected here rather than stored as an empty string.
  if (decision === "revision_requested" && feedbackRaw.length === 0) {
    return { ok: false, error: "Merci d'indiquer ce qui doit être modifié." };
  }
  if (feedbackRaw.length > 2000) {
    return { ok: false, error: "Commentaire trop long (2000 caractères maximum)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_set_approval", {
    item_id: itemId,
    decision,
    feedback: feedbackRaw.length > 0 ? feedbackRaw : null,
  });

  if (error) {
    // The database returns the same "Item not found" for a missing item and
    // for another organisation's item, deliberately — a distinct message would
    // let a client enumerate ids. That opacity is preserved by passing the
    // message straight through rather than trying to improve on it.
    return { ok: false, error: error.message };
  }

  revalidatePath("/portal");
  return { ok: true };
}
