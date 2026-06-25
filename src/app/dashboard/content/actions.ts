"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireWorkerOrAdmin } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type ContentItemStatus =
  | "idea"
  | "copywriting"
  | "design"
  | "editing"
  | "internal_review"
  | "client_review"
  | "approved"
  | "scheduled"
  | "published";

export type ContentType = "post" | "reel" | "story" | "carousel" | "video" | "article";
export type ContentPlatform = "instagram" | "facebook" | "linkedin" | "twitter" | "tiktok" | "youtube" | "threads";
export type PlanStatus = "draft" | "approved" | "archived";
export type ApprovalStatus = "pending" | "approved" | "revision_requested";
export type ContentPriority = "low" | "normal" | "high" | "urgent";

const CONTENT_STATUSES: ContentItemStatus[] = [
  "idea", "copywriting", "design", "editing",
  "internal_review", "client_review", "approved", "scheduled", "published",
];
const CONTENT_TYPES: ContentType[] = ["post", "reel", "story", "carousel", "video", "article"];
const PLATFORMS: ContentPlatform[] = ["instagram", "facebook", "linkedin", "twitter", "tiktok", "youtube", "threads"];
const PRIORITIES: ContentPriority[] = ["low", "normal", "high", "urgent"];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function strOrNull(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}
function strArray(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((v) => String(v).trim())
    .filter(Boolean);
}

// ─── Client Content Profile ────────────────────────────────────────────────────

export async function upsertContentProfileAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireWorkerOrAdmin();
  const supabase = await createClient();

  const client_id = str(formData, "client_id");
  if (!client_id) return { ok: false, error: "Client requis." };

  const platforms = strArray(formData, "platforms");
  const pillarsRaw = strOrNull(formData, "content_pillars");
  const content_pillars = pillarsRaw
    ? pillarsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

  const { error } = await supabase.from("client_content_profiles").upsert(
    {
      client_id,
      brand_voice: strOrNull(formData, "brand_voice"),
      industry: strOrNull(formData, "industry"),
      target_audience: strOrNull(formData, "target_audience"),
      services: strOrNull(formData, "services"),
      platforms,
      monthly_goal: strOrNull(formData, "monthly_goal"),
      posting_frequency: strOrNull(formData, "posting_frequency"),
      content_pillars,
      design_direction: strOrNull(formData, "design_direction"),
      forbidden_topics: strOrNull(formData, "forbidden_topics"),
      competitors: strOrNull(formData, "competitors"),
      notes: strOrNull(formData, "notes"),
      created_by: session.id,
    },
    { onConflict: "client_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/content");
  revalidatePath(`/dashboard/content/clients/${client_id}`);
  return { ok: true };
}

// ─── Monthly Content Plan ──────────────────────────────────────────────────────

export async function createContentPlanAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireWorkerOrAdmin();
  const supabase = await createClient();

  const client_id = str(formData, "client_id");
  const month = parseInt(str(formData, "month"), 10);
  const year = parseInt(str(formData, "year"), 10);

  if (!client_id) return { ok: false, error: "Client requis." };
  if (!month || month < 1 || month > 12) return { ok: false, error: "Mois invalide." };
  if (!year || year < 2020) return { ok: false, error: "Année invalide." };

  const { data, error } = await supabase
    .from("monthly_content_plans")
    .insert({
      client_id,
      month,
      year,
      theme: strOrNull(formData, "theme"),
      goals: strOrNull(formData, "goals"),
      status: "draft",
      created_by: session.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/content");
  revalidatePath(`/dashboard/content/clients/${client_id}`);
  return { ok: true, ...(data ? { planId: data.id } : {}) };
}

export async function updateContentPlanAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const supabase = await createClient();

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Plan introuvable." };

  const { data: plan, error: fetchErr } = await supabase
    .from("monthly_content_plans")
    .select("client_id")
    .eq("id", id)
    .single();

  if (fetchErr || !plan) return { ok: false, error: "Plan introuvable." };

  const { error } = await supabase
    .from("monthly_content_plans")
    .update({
      theme: strOrNull(formData, "theme"),
      goals: strOrNull(formData, "goals"),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/content/plans/${id}`);
  revalidatePath(`/dashboard/content/clients/${plan.client_id}`);
  return { ok: true };
}

export async function approveContentPlanAction(planId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await createClient();

  const { data: plan, error: fetchErr } = await supabase
    .from("monthly_content_plans")
    .select("id, client_id, status")
    .eq("id", planId)
    .single();

  if (fetchErr || !plan) return { ok: false, error: "Plan introuvable." };
  if (plan.status === "approved") return { ok: true };

  const { error } = await supabase
    .from("monthly_content_plans")
    .update({
      status: "approved",
      approved_by: session.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", planId);

  if (error) return { ok: false, error: error.message };

  // Automatically create tasks for all content items in this plan
  const { data: items } = await supabase
    .from("content_items")
    .select("id, title, content_type, caption, deadline, assigned_to, platform, client_id")
    .eq("plan_id", planId)
    .is("task_id", null);

  const { data: clientData } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", plan.client_id)
    .single();

  // Find the default project for this client (first active project)
  const { data: projectData } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", plan.client_id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const project_id = projectData?.id ?? null;

  let tasksCreated = 0;
  if (items && project_id) {
    for (const item of items) {
      const needsCopywriting = !!item.caption || ["post", "article", "carousel"].includes(item.content_type);
      const needsDesign = ["post", "carousel"].includes(item.content_type);
      const needsEditing = ["reel", "video"].includes(item.content_type);

      const taskTitle = `[Content] ${item.title} — ${item.platform}`;

      // Determine priority and task type
      let taskDescription = `Contenu pour ${clientData?.name ?? "client"}.\nType: ${item.content_type}\nPlateforme: ${item.platform}`;
      if (item.caption) taskDescription += `\n\nCaption: ${item.caption}`;

      const { data: task } = await supabase
        .from("tasks")
        .insert({
          project_id,
          title: taskTitle,
          description: taskDescription,
          status: needsCopywriting ? "todo" : needsDesign ? "todo" : "todo",
          priority: "normal",
          assignee_id: item.assigned_to ?? null,
          deadline: item.deadline ?? null,
          created_by: session.id,
          tags: ["content-os", item.content_type, item.platform],
        })
        .select("id")
        .single();

      if (task) {
        await supabase
          .from("content_items")
          .update({ task_id: task.id })
          .eq("id", item.id);
        tasksCreated++;

        if (item.assigned_to) {
          await supabase.from("task_assignees").insert({
            task_id: task.id,
            user_id: item.assigned_to,
          });
        }
      }
    }
  }

  revalidatePath("/dashboard/content");
  revalidatePath(`/dashboard/content/plans/${planId}`);
  revalidatePath(`/dashboard/content/clients/${plan.client_id}`);
  revalidatePath("/dashboard/tasks");

  return { ok: true, ...(tasksCreated > 0 ? { tasksCreated } : {}) };
}

export async function archiveContentPlanAction(planId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: plan, error: fetchErr } = await supabase
    .from("monthly_content_plans")
    .select("client_id")
    .eq("id", planId)
    .single();

  if (fetchErr || !plan) return { ok: false, error: "Plan introuvable." };

  const { error } = await supabase
    .from("monthly_content_plans")
    .update({ status: "archived" })
    .eq("id", planId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/content/plans/${planId}`);
  revalidatePath(`/dashboard/content/clients/${plan.client_id}`);
  return { ok: true };
}

// ─── Content Items ─────────────────────────────────────────────────────────────

export async function createContentItemAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireWorkerOrAdmin();
  const supabase = await createClient();

  const plan_id = str(formData, "plan_id");
  const client_id = str(formData, "client_id");
  const title = str(formData, "title");

  if (!plan_id) return { ok: false, error: "Plan requis." };
  if (!client_id) return { ok: false, error: "Client requis." };
  if (!title) return { ok: false, error: "Titre requis." };

  const rawType = str(formData, "content_type") as ContentType;
  const content_type: ContentType = CONTENT_TYPES.includes(rawType) ? rawType : "post";
  const rawPlatform = str(formData, "platform") as ContentPlatform;
  const platform: ContentPlatform = PLATFORMS.includes(rawPlatform) ? rawPlatform : "instagram";
  const rawPriority = str(formData, "priority") as ContentPriority;
  const priority: ContentPriority = PRIORITIES.includes(rawPriority) ? rawPriority : "normal";

  const { error } = await supabase.from("content_items").insert({
    plan_id,
    client_id,
    title,
    content_type,
    platform,
    pillar: strOrNull(formData, "pillar"),
    caption: strOrNull(formData, "caption"),
    visual_direction: strOrNull(formData, "visual_direction"),
    publish_date: strOrNull(formData, "publish_date"),
    deadline: strOrNull(formData, "deadline"),
    assigned_to: strOrNull(formData, "assigned_to"),
    status: "idea",
    priority,
    created_by: session.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/content/plans/${plan_id}`);
  revalidatePath("/dashboard/content/calendar");
  return { ok: true };
}

export async function updateContentItemAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const supabase = await createClient();

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Élément introuvable." };

  const { data: item, error: fetchErr } = await supabase
    .from("content_items")
    .select("plan_id, client_id")
    .eq("id", id)
    .single();

  if (fetchErr || !item) return { ok: false, error: "Élément introuvable." };

  const rawType = str(formData, "content_type") as ContentType;
  const content_type: ContentType = CONTENT_TYPES.includes(rawType) ? rawType : "post";
  const rawPlatform = str(formData, "platform") as ContentPlatform;
  const platform: ContentPlatform = PLATFORMS.includes(rawPlatform) ? rawPlatform : "instagram";
  const rawStatus = str(formData, "status") as ContentItemStatus;
  const status: ContentItemStatus = CONTENT_STATUSES.includes(rawStatus) ? rawStatus : "idea";
  const rawPriority = str(formData, "priority") as ContentPriority;
  const priority: ContentPriority = PRIORITIES.includes(rawPriority) ? rawPriority : "normal";
  const rawApproval = str(formData, "approval_status") as ApprovalStatus;
  const approval_status: ApprovalStatus =
    ["pending", "approved", "revision_requested"].includes(rawApproval)
      ? rawApproval
      : "pending";

  const { error } = await supabase
    .from("content_items")
    .update({
      title: str(formData, "title"),
      content_type,
      platform,
      pillar: strOrNull(formData, "pillar"),
      caption: strOrNull(formData, "caption"),
      visual_direction: strOrNull(formData, "visual_direction"),
      publish_date: strOrNull(formData, "publish_date"),
      deadline: strOrNull(formData, "deadline"),
      assigned_to: strOrNull(formData, "assigned_to"),
      status,
      priority,
      client_feedback: strOrNull(formData, "client_feedback"),
      approval_status,
      final_asset_url: strOrNull(formData, "final_asset_url"),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/content/items/${id}`);
  revalidatePath(`/dashboard/content/plans/${item.plan_id}`);
  revalidatePath("/dashboard/content/calendar");
  return { ok: true };
}

export async function changeContentItemStatusAction(
  itemId: string,
  status: ContentItemStatus,
): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const supabase = await createClient();

  if (!CONTENT_STATUSES.includes(status)) {
    return { ok: false, error: "Statut invalide." };
  }

  const { data: item, error: fetchErr } = await supabase
    .from("content_items")
    .select("plan_id")
    .eq("id", itemId)
    .single();

  if (fetchErr || !item) return { ok: false, error: "Élément introuvable." };

  const { error } = await supabase
    .from("content_items")
    .update({ status })
    .eq("id", itemId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/content/items/${itemId}`);
  revalidatePath(`/dashboard/content/plans/${item.plan_id}`);
  return { ok: true };
}

export async function deleteContentItemAction(itemId: string): Promise<ActionResult> {
  await requireWorkerOrAdmin();
  const supabase = await createClient();

  const { data: item, error: fetchErr } = await supabase
    .from("content_items")
    .select("plan_id")
    .eq("id", itemId)
    .single();

  if (fetchErr || !item) return { ok: false, error: "Élément introuvable." };

  const { error } = await supabase.from("content_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/content/plans/${item.plan_id}`);
  revalidatePath("/dashboard/content/calendar");
  return { ok: true };
}
