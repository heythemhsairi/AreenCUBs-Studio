"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { toast } from "@/components/toast";
import { updateContentItemAction } from "../../actions";
import type { ContentItemStatus, ContentType, ContentPlatform, ContentPriority } from "../../actions";
import { ChevronLeft, ExternalLink } from "lucide-react";

type ProfileRef = { id: string; full_name: string | null; username: string } | null;
type PlanRef = {
  id: string;
  month: number;
  year: number;
  theme: string | null;
  client_id: string;
  clients: { id: string; name: string } | null;
} | null;

type ContentItem = {
  id: string;
  title: string;
  content_type: string;
  platform: string;
  pillar: string | null;
  caption: string | null;
  visual_direction: string | null;
  publish_date: string | null;
  deadline: string | null;
  status: string;
  priority: string;
  client_feedback: string | null;
  approval_status: string | null;
  final_asset_url: string | null;
  task_id: string | null;
  assigned_to: string | null;
  plan_id: string;
  profiles: ProfileRef;
  monthly_content_plans: PlanRef;
};
type Member = { id: string; full_name: string | null; username: string; avatar_url: string | null };

type Props = { item: ContentItem; members: Member[] };

const CONTENT_TYPES: ContentType[] = ["post", "reel", "story", "carousel", "video", "article"];
const PLATFORMS: ContentPlatform[] = ["instagram", "facebook", "linkedin", "twitter", "tiktok", "youtube", "threads"];
const PRIORITIES: ContentPriority[] = ["low", "normal", "high", "urgent"];
const ITEM_STATUSES: ContentItemStatus[] = [
  "idea", "copywriting", "design", "editing",
  "internal_review", "client_review", "approved", "scheduled", "published",
];

const ITEM_STATUS_BG: Record<string, string> = {
  idea: "bg-slate-500/15 text-slate-400",
  copywriting: "bg-blue-500/15 text-blue-400",
  design: "bg-violet-500/15 text-violet-400",
  editing: "bg-orange-500/15 text-orange-400",
  internal_review: "bg-yellow-500/15 text-yellow-400",
  client_review: "bg-pink-500/15 text-pink-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  scheduled: "bg-cyan-500/15 text-cyan-400",
  published: "bg-green-500/15 text-green-400",
};

export function ContentItemDetailClient({ item, members }: Props) {
  const { t, locale } = useI18n();
  const c = t.contentOS;
  const monthNames = c.months;
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const plan = item.monthly_content_plans;
  const client = plan?.clients;
  const monthLabel = plan ? monthNames[plan.month - 1] : "";

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("id", item.id);
    startTransition(async () => {
      const res = await updateContentItemAction(formData);
      if (res.ok) {
        toast.success(locale === "en" ? "Saved" : "Enregistré");
        setEditing(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--c-text-3)] flex-wrap">
        <Link href="/dashboard/content" className="hover:text-[var(--c-text-1)] flex items-center gap-1 transition-colors">
          <ChevronLeft size={14} />
          {c.title}
        </Link>
        {client && (
          <>
            <span>/</span>
            <Link
              href={`/dashboard/content/clients/${plan?.client_id}`}
              className="hover:text-[var(--c-text-1)] transition-colors"
            >
              {client.name}
            </Link>
          </>
        )}
        {plan && (
          <>
            <span>/</span>
            <Link
              href={`/dashboard/content/plans/${plan.id}`}
              className="hover:text-[var(--c-text-1)] transition-colors"
            >
              {monthLabel} {plan.year}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-[var(--c-text-1)] font-medium line-clamp-1 max-w-[200px]">{item.title}</span>
      </div>

      {/* Status badge strip */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", ITEM_STATUS_BG[item.status] ?? "bg-[var(--c-border)] text-[var(--c-text-3)]")}>
          {c.itemStatus[item.status as keyof typeof c.itemStatus] ?? item.status}
        </span>
        <span className="text-xs text-[var(--c-text-3)] capitalize">{item.platform}</span>
        <span className="text-xs text-[var(--c-text-3)]">
          {c.contentType[item.content_type as keyof typeof c.contentType] ?? item.content_type}
        </span>
        {item.task_id && (
          <Link
            href={`/dashboard/tasks/${item.task_id}`}
            className="flex items-center gap-1 rounded-md bg-[#22D3EE]/10 px-2 py-0.5 text-[11px] text-[#22D3EE] hover:bg-[#22D3EE]/20 transition-colors"
          >
            <ExternalLink size={10} />
            {locale === "en" ? "Linked task" : "Tâche liée"}
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content card */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)]">
              <h1 className="font-bold text-[var(--c-text-1)]">{item.title}</h1>
              <button
                type="button"
                onClick={() => setEditing(!editing)}
                className="text-sm text-[#22D3EE] hover:text-[#22D3EE]/80 transition-colors"
              >
                {editing ? t.common.cancel : t.common.edit}
              </button>
            </div>

            {editing ? (
              <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label={c.itemFields.title} className="sm:col-span-2">
                    <input
                      name="title"
                      defaultValue={item.title}
                      required
                      className="input-base"
                    />
                  </FormField>
                  <FormField label={c.itemFields.contentType}>
                    <select name="content_type" defaultValue={item.content_type} className="input-base">
                      {CONTENT_TYPES.map((ct) => (
                        <option key={ct} value={ct}>{c.contentType[ct as keyof typeof c.contentType]}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label={c.itemFields.platform}>
                    <select name="platform" defaultValue={item.platform} className="input-base">
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p} className="capitalize">{p}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label={c.itemFields.status}>
                    <select name="status" defaultValue={item.status} className="input-base">
                      {ITEM_STATUSES.map((s) => (
                        <option key={s} value={s}>{c.itemStatus[s as keyof typeof c.itemStatus]}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label={c.itemFields.priority}>
                    <select name="priority" defaultValue={item.priority} className="input-base">
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{t.tasks.priority[p as keyof typeof t.tasks.priority]}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label={c.itemFields.pillar}>
                    <input
                      name="pillar"
                      defaultValue={item.pillar ?? ""}
                      placeholder={c.itemPlaceholders.pillar}
                      className="input-base"
                    />
                  </FormField>
                  <FormField label={c.itemFields.assignedTo}>
                    <select name="assigned_to" defaultValue={item.assigned_to ?? ""} className="input-base">
                      <option value="">{t.tasks.form.unassigned}</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name ?? m.username}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label={c.itemFields.publishDate}>
                    <input name="publish_date" type="date" defaultValue={item.publish_date ?? ""} className="input-base" />
                  </FormField>
                  <FormField label={c.itemFields.deadline}>
                    <input name="deadline" type="date" defaultValue={item.deadline ?? ""} className="input-base" />
                  </FormField>
                  <FormField label={c.itemFields.caption} className="sm:col-span-2">
                    <textarea
                      name="caption"
                      defaultValue={item.caption ?? ""}
                      placeholder={c.itemPlaceholders.caption}
                      rows={4}
                      className="input-base"
                    />
                  </FormField>
                  <FormField label={c.itemFields.visualDirection} className="sm:col-span-2">
                    <input
                      name="visual_direction"
                      defaultValue={item.visual_direction ?? ""}
                      placeholder={c.itemPlaceholders.visualDirection}
                      className="input-base"
                    />
                  </FormField>
                  <FormField label={c.itemFields.clientFeedback} className="sm:col-span-2">
                    <textarea
                      name="client_feedback"
                      defaultValue={item.client_feedback ?? ""}
                      placeholder={c.itemPlaceholders.clientFeedback}
                      rows={2}
                      className="input-base"
                    />
                  </FormField>
                  <FormField label={c.itemFields.approvalStatus}>
                    <select name="approval_status" defaultValue={item.approval_status ?? "pending"} className="input-base">
                      <option value="pending">{c.approvalStatus.pending}</option>
                      <option value="approved">{c.approvalStatus.approved}</option>
                      <option value="revision_requested">{c.approvalStatus.revision_requested}</option>
                    </select>
                  </FormField>
                  <FormField label={c.itemFields.finalAssetUrl}>
                    <input
                      name="final_asset_url"
                      type="url"
                      defaultValue={item.final_asset_url ?? ""}
                      placeholder={c.itemPlaceholders.finalAssetUrl}
                      className="input-base"
                    />
                  </FormField>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-4 py-2 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] transition-colors"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-[#071B2C] hover:bg-[#22D3EE]/90 disabled:opacity-60 transition-colors"
                  >
                    {isPending ? t.common.saving : t.common.save}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-5 flex flex-col gap-5">
                {item.caption && (
                  <section>
                    <h3 className="text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-wider mb-2">
                      {c.itemFields.caption}
                    </h3>
                    <p className="text-sm text-[var(--c-text-1)] whitespace-pre-line bg-[var(--c-elevated)] rounded-lg p-3">
                      {item.caption}
                    </p>
                  </section>
                )}
                {item.visual_direction && (
                  <section>
                    <h3 className="text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-wider mb-2">
                      {c.itemFields.visualDirection}
                    </h3>
                    <p className="text-sm text-[var(--c-text-1)]">{item.visual_direction}</p>
                  </section>
                )}
                {item.client_feedback && (
                  <section>
                    <h3 className="text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-wider mb-2">
                      {c.itemFields.clientFeedback}
                    </h3>
                    <p className="text-sm text-[var(--c-text-1)] whitespace-pre-line bg-pink-500/5 rounded-lg p-3 border border-pink-500/15">
                      {item.client_feedback}
                    </p>
                  </section>
                )}
                {item.final_asset_url && (
                  <section>
                    <h3 className="text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-wider mb-2">
                      {c.itemFields.finalAssetUrl}
                    </h3>
                    <a
                      href={item.final_asset_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-[#22D3EE] hover:underline"
                    >
                      <ExternalLink size={13} />
                      {item.final_asset_url}
                    </a>
                  </section>
                )}
                {!item.caption && !item.visual_direction && !item.client_feedback && !item.final_asset_url && (
                  <p className="text-sm text-[var(--c-text-3)]">
                    {locale === "en" ? "No content yet. Click 'Edit' to fill in the details." : "Pas encore de contenu. Cliquez sur 'Modifier' pour remplir les détails."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Meta */}
          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-wider">
              {locale === "en" ? "Details" : "Détails"}
            </h3>
            <MetaRow label={c.itemFields.status}>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", ITEM_STATUS_BG[item.status] ?? "bg-[var(--c-border)] text-[var(--c-text-3)]")}>
                {c.itemStatus[item.status as keyof typeof c.itemStatus] ?? item.status}
              </span>
            </MetaRow>
            <MetaRow label={c.itemFields.contentType}>
              <span className="text-sm text-[var(--c-text-1)]">
                {c.contentType[item.content_type as keyof typeof c.contentType] ?? item.content_type}
              </span>
            </MetaRow>
            <MetaRow label={c.itemFields.platform}>
              <span className="text-sm text-[var(--c-text-1)] capitalize">{item.platform}</span>
            </MetaRow>
            {item.pillar && (
              <MetaRow label={c.itemFields.pillar}>
                <span className="text-sm text-[var(--c-text-1)]">{item.pillar}</span>
              </MetaRow>
            )}
            <MetaRow label={c.itemFields.priority}>
              <span className="text-sm text-[var(--c-text-1)]">
                {t.tasks.priority[item.priority as keyof typeof t.tasks.priority]}
              </span>
            </MetaRow>
            <MetaRow label={c.itemFields.assignedTo}>
              <span className="text-sm text-[var(--c-text-1)]">
                {item.profiles?.full_name ?? item.profiles?.username ?? (
                  <em className="text-[var(--c-text-3)]">{t.tasks.form.unassigned}</em>
                )}
              </span>
            </MetaRow>
            {item.publish_date && (
              <MetaRow label={c.itemFields.publishDate}>
                <span className="text-sm text-[var(--c-text-1)]">
                  {new Date(item.publish_date).toLocaleDateString(
                    locale === "en" ? "en-US" : "fr-FR",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                </span>
              </MetaRow>
            )}
            {item.deadline && (
              <MetaRow label={c.itemFields.deadline}>
                <span className="text-sm text-[var(--c-text-1)]">
                  {new Date(item.deadline).toLocaleDateString(
                    locale === "en" ? "en-US" : "fr-FR",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                </span>
              </MetaRow>
            )}
            <MetaRow label={c.itemFields.approvalStatus}>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                item.approval_status === "approved"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : item.approval_status === "revision_requested"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-[var(--c-border)] text-[var(--c-text-3)]",
              )}>
                {c.approvalStatus[
                  (item.approval_status ?? "pending") as keyof typeof c.approvalStatus
                ] ?? item.approval_status}
              </span>
            </MetaRow>
          </div>

          {/* Plan link */}
          {plan && (
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
              <h3 className="text-xs font-semibold text-[var(--c-text-3)] uppercase tracking-wider mb-3">
                {locale === "en" ? "Plan" : "Plan"}
              </h3>
              <Link
                href={`/dashboard/content/plans/${plan.id}`}
                className="flex items-center gap-2 rounded-lg bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] hover:text-[#22D3EE] hover:bg-[#22D3EE]/5 transition-colors"
              >
                <ExternalLink size={13} className="text-[var(--c-text-3)]" />
                {monthNames[plan.month - 1]} {plan.year}
                {plan.theme ? ` — ${plan.theme}` : ""}
              </Link>
              {client && (
                <Link
                  href={`/dashboard/content/clients/${plan.client_id}`}
                  className="mt-2 flex items-center gap-2 text-xs text-[var(--c-text-3)] hover:text-[var(--c-text-1)] transition-colors"
                >
                  {client.name}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-[var(--c-text-3)]">{label}</span>
      {children}
    </label>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-[var(--c-text-3)] shrink-0">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}
