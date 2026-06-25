"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { toast } from "@/components/toast";
import {
  createContentItemAction,
  deleteContentItemAction,
  approveContentPlanAction,
  archiveContentPlanAction,
  changeContentItemStatusAction,
} from "../../actions";
import type { ContentItemStatus, ContentType, ContentPlatform, ContentPriority } from "../../actions";
import {
  ChevronLeft, Plus, CheckCircle2, Trash2, ExternalLink, Layers,
} from "lucide-react";

type AssigneeProfile = { id: string; full_name: string | null; username: string } | null;
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
  profiles: AssigneeProfile;
};
type Plan = {
  id: string;
  client_id: string;
  month: number;
  year: number;
  theme: string | null;
  goals: string | null;
  status: string;
  approved_at: string | null;
  clients: { id: string; name: string } | null;
};
type Member = { id: string; full_name: string | null; username: string; avatar_url: string | null };

type Props = {
  plan: Plan;
  items: ContentItem[];
  members: Member[];
};

const CONTENT_TYPES: ContentType[] = ["post", "reel", "story", "carousel", "video", "article"];
const PLATFORMS: ContentPlatform[] = ["instagram", "facebook", "linkedin", "twitter", "tiktok", "youtube", "threads"];
const PRIORITIES: ContentPriority[] = ["low", "normal", "high", "urgent"];
const ITEM_STATUSES: ContentItemStatus[] = [
  "idea", "copywriting", "design", "editing",
  "internal_review", "client_review", "approved", "scheduled", "published",
];

const STATUS_BG: Record<string, string> = {
  draft: "bg-[var(--c-border)] text-[var(--c-text-3)]",
  approved: "bg-emerald-500/15 text-emerald-400",
  archived: "bg-[var(--c-border)] text-[var(--c-text-3)]",
};

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

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-slate-400",
  normal: "text-[var(--c-text-3)]",
  high: "text-amber-400",
  urgent: "text-red-400",
};

export function ContentPlanDetailClient({ plan, items, members }: Props) {
  const { t, locale } = useI18n();
  const c = t.contentOS;
  const monthNames = c.months;
  const [isPending, startTransition] = useTransition();
  const [showNewItem, setShowNewItem] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const clientName = plan.clients?.name ?? "";
  const monthLabel = monthNames[plan.month - 1];

  function handleApprovePlan() {
    startTransition(async () => {
      const res = await approveContentPlanAction(plan.id);
      if (res.ok) {
        const tasksCreated = (res as { ok: true; tasksCreated?: number }).tasksCreated ?? 0;
        toast.success(
          tasksCreated > 0
            ? c.autoTasksCreated(tasksCreated)
            : c.planApproved,
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleArchivePlan() {
    startTransition(async () => {
      const res = await archiveContentPlanAction(plan.id);
      if (res.ok) {
        toast.success(c.planArchived);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleCreateItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("plan_id", plan.id);
    formData.set("client_id", plan.client_id);
    startTransition(async () => {
      const res = await createContentItemAction(formData);
      if (res.ok) {
        toast.success(c.itemCreated);
        setShowNewItem(false);
        (e.target as HTMLFormElement).reset();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDeleteItem(itemId: string) {
    if (!confirm(c.deleteItemConfirm)) return;
    startTransition(async () => {
      const res = await deleteContentItemAction(itemId);
      if (res.ok) {
        toast.success(c.itemDeleted);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleChangeStatus(itemId: string, status: ContentItemStatus) {
    startTransition(async () => {
      const res = await changeContentItemStatusAction(itemId, status);
      if (!res.ok) toast.error(res.error);
    });
  }

  const filteredItems =
    filterStatus === "all" ? items : items.filter((i) => i.status === filterStatus);

  const statusCounts = ITEM_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = items.filter((i) => i.status === s).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--c-text-3)] flex-wrap">
        <Link href="/dashboard/content" className="hover:text-[var(--c-text-1)] flex items-center gap-1 transition-colors">
          <ChevronLeft size={14} />
          {c.title}
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/content/clients/${plan.client_id}`}
          className="hover:text-[var(--c-text-1)] transition-colors"
        >
          {clientName}
        </Link>
        <span>/</span>
        <span className="text-[var(--c-text-1)] font-medium">
          {monthLabel} {plan.year}
        </span>
      </div>

      {/* Plan header */}
      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--c-text-1)]">
                {monthLabel} {plan.year}
              </h1>
              {plan.theme && (
                <span className="text-sm text-[var(--c-text-3)]">— {plan.theme}</span>
              )}
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_BG[plan.status] ?? STATUS_BG.draft)}>
                {c.planStatus[plan.status as keyof typeof c.planStatus] ?? plan.status}
              </span>
            </div>
            {plan.goals && (
              <p className="mt-2 text-sm text-[var(--c-text-2)] max-w-xl">{plan.goals}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {plan.status === "draft" && (
              <button
                type="button"
                onClick={handleApprovePlan}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-3 py-2 text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-60 transition-colors"
              >
                <CheckCircle2 size={14} />
                {c.approvePlan}
              </button>
            )}
            {plan.status !== "archived" && (
              <button
                type="button"
                onClick={handleArchivePlan}
                disabled={isPending}
                className="rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] disabled:opacity-60 transition-colors"
              >
                {c.archivePlan}
              </button>
            )}
            <Link
              href={`/dashboard/content/calendar?client=${plan.client_id}`}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-elevated)] transition-colors"
            >
              <ExternalLink size={13} />
              {c.calendar}
            </Link>
          </div>
        </div>

        {/* Status pipeline mini progress */}
        <div className="mt-5 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {ITEM_STATUSES.map((s, i) => {
              const count = statusCounts[s] ?? 0;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-all",
                    filterStatus === s
                      ? "bg-[#22D3EE]/15 text-[#22D3EE] ring-1 ring-[#22D3EE]/40"
                      : "text-[var(--c-text-3)] hover:bg-[var(--c-elevated)]",
                  )}
                >
                  <span className="font-semibold text-base">{count}</span>
                  <span className="leading-tight text-center" style={{ fontSize: "9px" }}>
                    {c.itemStatus[s as keyof typeof c.itemStatus]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content items */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--c-text-1)]">
            {c.contentItems}
            {filterStatus !== "all" && (
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className="ml-2 text-xs text-[#22D3EE] hover:underline"
              >
                {c.showAll}
              </button>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setShowNewItem(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-[#22D3EE] px-3 py-2 text-sm font-medium hover:bg-[#22D3EE]/20 transition-colors"
          >
            <Plus size={14} />
            {c.newItem}
          </button>
        </div>

        {/* New item form */}
        {showNewItem && (
          <form
            onSubmit={handleCreateItem}
            className="rounded-xl border border-[#22D3EE]/30 bg-[var(--c-card)] p-4 flex flex-col gap-4"
          >
            <h3 className="text-sm font-semibold text-[var(--c-text-1)]">{c.createItem}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label={c.itemFields.title} className="sm:col-span-2 lg:col-span-3">
                <input
                  name="title"
                  required
                  placeholder={c.itemPlaceholders.title}
                  className="input-base"
                />
              </FormField>
              <FormField label={c.itemFields.contentType}>
                <select name="content_type" className="input-base">
                  {CONTENT_TYPES.map((ct) => (
                    <option key={ct} value={ct}>{c.contentType[ct as keyof typeof c.contentType]}</option>
                  ))}
                </select>
              </FormField>
              <FormField label={c.itemFields.platform}>
                <select name="platform" className="input-base">
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p} className="capitalize">{p}</option>
                  ))}
                </select>
              </FormField>
              <FormField label={c.itemFields.priority}>
                <select name="priority" defaultValue="normal" className="input-base">
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{t.tasks.priority[p as keyof typeof t.tasks.priority]}</option>
                  ))}
                </select>
              </FormField>
              <FormField label={c.itemFields.pillar}>
                <input
                  name="pillar"
                  placeholder={c.itemPlaceholders.pillar}
                  className="input-base"
                />
              </FormField>
              <FormField label={c.itemFields.publishDate}>
                <input name="publish_date" type="date" className="input-base" />
              </FormField>
              <FormField label={c.itemFields.deadline}>
                <input name="deadline" type="date" className="input-base" />
              </FormField>
              <FormField label={c.itemFields.assignedTo}>
                <select name="assigned_to" className="input-base">
                  <option value="">{t.tasks.form.unassigned}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name ?? m.username}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label={c.itemFields.caption} className="sm:col-span-2 lg:col-span-3">
                <textarea
                  name="caption"
                  placeholder={c.itemPlaceholders.caption}
                  rows={2}
                  className="input-base"
                />
              </FormField>
              <FormField label={c.itemFields.visualDirection} className="sm:col-span-2 lg:col-span-3">
                <input
                  name="visual_direction"
                  placeholder={c.itemPlaceholders.visualDirection}
                  className="input-base"
                />
              </FormField>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowNewItem(false)}
                className="rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-4 py-2 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-[#071B2C] hover:bg-[#22D3EE]/90 disabled:opacity-60 transition-colors"
              >
                {isPending ? t.common.saving : c.createItem}
              </button>
            </div>
          </form>
        )}

        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-card)] py-12 text-center">
            <Layers size={28} className="mx-auto mb-3 text-[var(--c-text-3)]" />
            <p className="text-sm text-[var(--c-text-3)]">{c.noItems}</p>
            <button
              type="button"
              onClick={() => setShowNewItem(true)}
              className="mt-3 text-sm text-[#22D3EE] hover:underline"
            >
              {c.addFirstItem}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--c-border)] bg-[var(--c-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-xs text-[var(--c-text-3)] bg-[var(--c-elevated)]">
                  <th className="px-4 py-3 text-left font-semibold">{c.itemFields.title}</th>
                  <th className="px-4 py-3 text-left font-semibold">{c.itemFields.contentType}</th>
                  <th className="px-4 py-3 text-left font-semibold">{c.itemFields.platform}</th>
                  <th className="px-4 py-3 text-left font-semibold">{c.itemFields.assignedTo}</th>
                  <th className="px-4 py-3 text-left font-semibold">{c.itemFields.publishDate}</th>
                  <th className="px-4 py-3 text-left font-semibold">{c.itemFields.status}</th>
                  <th className="px-4 py-3 text-left font-semibold">{c.itemFields.priority}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border)]">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--c-elevated)] transition-colors"
                  >
                    <td className="px-4 py-3 max-w-[200px]">
                      <Link
                        href={`/dashboard/content/items/${item.id}`}
                        className="font-medium text-[var(--c-text-1)] hover:text-[#22D3EE] transition-colors line-clamp-1"
                      >
                        {item.title}
                      </Link>
                      {item.pillar && (
                        <p className="text-[10px] text-[var(--c-text-3)] mt-0.5">{item.pillar}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--c-text-2)]">
                      {c.contentType[item.content_type as keyof typeof c.contentType] ?? item.content_type}
                    </td>
                    <td className="px-4 py-3 text-[var(--c-text-2)] capitalize">{item.platform}</td>
                    <td className="px-4 py-3 text-[var(--c-text-2)]">
                      {item.profiles?.full_name ?? item.profiles?.username ?? (
                        <em className="text-[var(--c-text-3)]">{t.tasks.form.unassigned}</em>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--c-text-2)]">
                      {item.publish_date
                        ? new Date(item.publish_date).toLocaleDateString(
                            locale === "en" ? "en-US" : "fr-FR",
                            { day: "numeric", month: "short" },
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.status}
                        onChange={(e) => handleChangeStatus(item.id, e.target.value as ContentItemStatus)}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold border-0 outline-none cursor-pointer",
                          ITEM_STATUS_BG[item.status] ?? "bg-[var(--c-border)] text-[var(--c-text-3)]",
                        )}
                      >
                        {ITEM_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {c.itemStatus[s as keyof typeof c.itemStatus]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium", PRIORITY_COLORS[item.priority])}>
                        {t.tasks.priority[item.priority as keyof typeof t.tasks.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/content/items/${item.id}`}
                          className="rounded p-1 text-[var(--c-text-3)] hover:text-[#22D3EE] hover:bg-[#22D3EE]/10 transition-colors"
                        >
                          <ExternalLink size={13} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={isPending}
                          className="rounded p-1 text-[var(--c-text-3)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
