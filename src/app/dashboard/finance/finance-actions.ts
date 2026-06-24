"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FollowUpResult = { ok: true } | { ok: false; error: string };

export async function markContactedAction(
  devisId: string,
  note: string,
  nextFollowup: string | null,
): Promise<FollowUpResult> {
  await requireAdmin();
  if (!devisId) return { ok: false, error: "ID manquant." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("devis")
    .update({
      contacted: true,
      last_followup_at: new Date().toISOString(),
      followup_note: note || null,
      next_followup_at: nextFollowup || null,
    })
    .eq("id", devisId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/finance");
  return { ok: true };
}

export async function createFollowUpTaskAction(
  devisId: string,
  devisNumber: number,
  clientName: string,
  amountDt: number,
): Promise<FollowUpResult> {
  const session = await requireAdmin();
  const supabase = await createClient();

  // Find a project for this devis to link the task to
  const { data: devis } = await supabase
    .from("devis")
    .select("client_id")
    .eq("id", devisId)
    .single();

  const clientId = devis?.client_id ?? null;

  let projectId: string | null = null;
  if (clientId) {
    const { data: proj } = await supabase
      .from("projects")
      .select("id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    projectId = proj?.id ?? null;
  }

  if (!projectId) {
    // Fall back to any project
    const { data: anyProj } = await supabase
      .from("projects")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    projectId = anyProj?.id ?? null;
  }

  if (!projectId) return { ok: false, error: "Aucun projet trouvé pour lier la tâche." };

  const title = `Relance impayé — ${clientName} (${amountDt.toFixed(0)} DT)`;
  const { error } = await supabase.from("tasks").insert({
    project_id: projectId,
    title,
    description: `Relance pour le devis/facture N°${devisNumber}.\nMontant restant : ${amountDt.toFixed(2)} DT.\n\nActions possibles :\n- Appeler le client\n- Envoyer un email de rappel\n- Vérifier l'état du paiement`,
    status: "todo",
    priority: "high",
    assignee_id: session.id,
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    tags: ["relance", "finance"],
    created_by: session.id,
  });

  if (error) return { ok: false, error: error.message };

  // Also mark as contacted
  await supabase
    .from("devis")
    .update({ last_followup_at: new Date().toISOString() })
    .eq("id", devisId);

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/tasks");
  return { ok: true };
}
