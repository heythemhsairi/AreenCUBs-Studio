"use client";

import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  createSocialPostAction,
  updateSocialPostAction,
  deleteSocialPostAction,
  duplicateSocialPostAction,
  changeSocialPostStatusAction,
  type SocialPlatform,
  type SocialPostStatus,
} from "@/app/dashboard/social-media/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SocialPost = {
  id: string;
  title: string;
  content: string;
  platforms: string[];
  status: SocialPostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  media_url: string | null;
  hashtags: string;
  first_comment: string;
  notes: string;
  project_id: string | null;
  task_id: string | null;
  project_name: string | null;
  task_title: string | null;
  created_by: string | null;
  creator_name: string | null;
  created_at: string;
};

type Project = { id: string; name: string; client_id: string | null };
type Task = { id: string; title: string; project_id: string | null };
type Client = { id: string; name: string };

type Props = {
  posts: SocialPost[];
  projects: Project[];
  tasks: Task[];
  clients: Client[];
  preselectedTaskId?: string;
};

// ─── Platform config ──────────────────────────────────────────────────────────

export const ALL_PLATFORMS: {
  id: SocialPlatform;
  label: string;
  icon: string;
  color: string;
  charLimit: number;
}[] = [
  { id: "instagram", label: "Instagram", icon: "📸", color: "from-purple-500 to-pink-500", charLimit: 2200 },
  { id: "facebook", label: "Facebook", icon: "👤", color: "from-[#1877f2] to-[#0e5bbd]", charLimit: 63206 },
  { id: "linkedin", label: "LinkedIn", icon: "💼", color: "from-[#0a66c2] to-[#064d93]", charLimit: 3000 },
  { id: "twitter", label: "Twitter / X", icon: "🐦", color: "from-[#1da1f2] to-[#0d7ab5]", charLimit: 280 },
  { id: "tiktok", label: "TikTok", icon: "🎵", color: "from-black to-[#222]", charLimit: 2200 },
  { id: "youtube", label: "YouTube", icon: "▶️", color: "from-[#ff0000] to-[#c00]", charLimit: 5000 },
  { id: "threads", label: "Threads", icon: "🧵", color: "from-[#101010] to-[#333]", charLimit: 500 },
  { id: "pinterest", label: "Pinterest", icon: "📌", color: "from-[#e60023] to-[#ad081b]", charLimit: 500 },
  { id: "snapchat", label: "Snapchat", icon: "👻", color: "from-[#fffc00] to-[#e6e300]", charLimit: 250 },
  { id: "telegram", label: "Telegram", icon: "✈️", color: "from-[#2ca5e0] to-[#1a85b8]", charLimit: 4096 },
];

function getPlatform(id: string) {
  return ALL_PLATFORMS.find((p) => p.id === id) ?? {
    id, label: id, icon: "📤",
    color: "from-[var(--c-border)] to-[var(--c-elevated)]", charLimit: 999,
  };
}

const STATUS_COLORS: Record<SocialPostStatus, string> = {
  draft: "bg-[var(--c-border)] text-[var(--c-text-3)]",
  scheduled: "bg-[#22D3EE]/15 text-[#22D3EE]",
  published: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-red-500/15 text-red-500",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

// ─── PlatformPicker ───────────────────────────────────────────────────────────

function PlatformPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ALL_PLATFORMS.map((p) => {
        const active = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            title={p.label}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-medium transition-all",
              active
                ? `bg-gradient-to-b ${p.color} border-transparent text-white shadow-sm`
                : "border-[var(--c-border)] bg-[var(--c-elevated)] text-[var(--c-text-3)] hover:border-[#22D3EE]/40 hover:text-[var(--c-text-1)]",
            )}
          >
            <span className="text-base leading-none">{p.icon}</span>
            <span className="leading-none">{p.label.split(" ")[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── CharCounter ─────────────────────────────────────────────────────────────

function CharCounter({
  text,
  platforms,
  lowestLimitLabel,
}: {
  text: string;
  platforms: string[];
  lowestLimitLabel: string;
}) {
  if (platforms.length === 0) return null;
  const limits = platforms.map((id) => getPlatform(id).charLimit);
  const minLimit = Math.min(...limits);
  const len = text.length;
  const pct = Math.min(len / minLimit, 1);
  const color = pct > 0.95 ? "text-red-500" : pct > 0.8 ? "text-amber-500" : "text-[var(--c-text-3)]";
  return (
    <span className={cn("text-[10px] tabular-nums", color)}>
      {len} / {minLimit}
      {platforms.length > 1 && (
        <span className="ml-1 text-[var(--c-text-3)]">{lowestLimitLabel}</span>
      )}
    </span>
  );
}

// ─── PlatformChips ────────────────────────────────────────────────────────────

function PlatformChips({ platforms, size = "sm" }: { platforms: string[]; size?: "xs" | "sm" }) {
  return (
    <div className="flex flex-wrap gap-1">
      {platforms.map((id) => {
        const p = getPlatform(id);
        return (
          <span
            key={id}
            className={cn(
              `inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r ${p.color} font-medium text-white`,
              size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
            )}
          >
            {p.icon} {p.label.split(" ")[0]}
          </span>
        );
      })}
    </div>
  );
}

// ─── PostChip (calendar cell) ─────────────────────────────────────────────────

function PostChip({ post, onClick }: { post: SocialPost; onClick: () => void }) {
  const first = getPlatform(post.platforms[0] ?? "");
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80",
        `bg-gradient-to-r ${first.color} text-white`,
      )}
      title={post.title}
    >
      {post.platforms.slice(0, 2).map((id) => getPlatform(id).icon).join("")}{" "}
      {post.title}
    </button>
  );
}

// ─── PostForm (single scrollable form, no tabs) ───────────────────────────────

function PostForm({
  post,
  projects,
  tasks,
  projectClientMap,
  defaultDate,
  preselectedTaskId,
  onClose,
  onSaved,
}: {
  post?: SocialPost;
  projects: Project[];
  tasks: Task[];
  projectClientMap: Map<string, string>;
  defaultDate?: string;
  preselectedTaskId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const c = t.contentOS;
  const taskFromId = preselectedTaskId ? tasks.find((tk) => tk.id === preselectedTaskId) : null;

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    post?.platforms.length ? post.platforms : [],
  );
  const [selectedProject, setSelectedProject] = useState(
    post?.project_id ?? taskFromId?.project_id ?? "",
  );
  const [content, setContent] = useState(post?.content ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filteredTasks = selectedProject
    ? tasks.filter((tk) => tk.project_id === selectedProject)
    : tasks;

  const inferredClient = selectedProject ? projectClientMap.get(selectedProject) : undefined;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedPlatforms.length === 0) {
      setError(c.pub_requiredPlatform);
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.delete("platforms");
    selectedPlatforms.forEach((p) => fd.append("platforms", p));
    startTransition(async () => {
      const result = post
        ? await updateSocialPostAction(fd)
        : await createSocialPostAction(fd);
      if (!result.ok) setError(result.error ?? "Error");
      else { onSaved(); onClose(); }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">
      {post && <input type="hidden" name="id" value={post.id} />}

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--c-text-3)]">
            {c.itemFields.title} <span className="text-red-400">*</span>
          </label>
          <input
            name="title"
            required
            defaultValue={post?.title}
            placeholder="E.g. Summer launch"
            className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] placeholder-[var(--c-text-3)] focus:border-[#22D3EE] focus:outline-none"
          />
        </div>

        {/* Platforms */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--c-text-3)]">
              {c.pub_platforms} <span className="text-red-400">*</span>
            </label>
            {selectedPlatforms.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedPlatforms([])}
                className="text-[10px] text-[var(--c-text-3)] hover:text-[var(--c-text-1)]"
              >
                {c.pub_clearAll}
              </button>
            )}
          </div>
          <PlatformPicker selected={selectedPlatforms} onChange={setSelectedPlatforms} />
        </div>

        {/* Content */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--c-text-3)]">{c.pub_content}</label>
            <CharCounter text={content} platforms={selectedPlatforms} lowestLimitLabel={c.pub_lowestLimit} />
          </div>
          <textarea
            name="content"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Post text, call to action…"
            className="w-full resize-none rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] placeholder-[var(--c-text-3)] focus:border-[#22D3EE] focus:outline-none"
          />
        </div>

        {/* Hashtags */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--c-text-3)]">{c.pub_hashtags}</label>
          <input
            name="hashtags"
            defaultValue={post?.hashtags}
            placeholder="#marketing #branding"
            className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] placeholder-[var(--c-text-3)] focus:border-[#22D3EE] focus:outline-none"
          />
        </div>

        {/* Scheduled date & time */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--c-text-3)]">
            {c.pub_scheduledAt}
          </label>
          <input
            name="scheduled_at"
            type="datetime-local"
            defaultValue={
              post?.scheduled_at
                ? new Date(post.scheduled_at).toISOString().slice(0, 16)
                : defaultDate ? `${defaultDate}T09:00` : ""
            }
            className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] focus:border-[#22D3EE] focus:outline-none"
          />
        </div>

        {/* Project */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--c-text-3)]">{c.pub_project}</label>
          <select
            name="project_id"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] focus:border-[#22D3EE] focus:outline-none"
          >
            <option value="">{c.pub_noProject}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Client (inferred — read-only) */}
        {inferredClient && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--c-text-3)]">{c.pub_client}</label>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-2">
              <span className="text-[10px] text-[var(--c-text-3)]">{c.pub_clientFromProject}:</span>
              <span className="rounded-full bg-[#22D3EE]/15 px-2 py-0.5 text-xs font-medium text-[#22D3EE]">
                {inferredClient}
              </span>
            </div>
          </div>
        )}

        {/* Linked task */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--c-text-3)]">{c.pub_task}</label>
          <select
            name="task_id"
            defaultValue={post?.task_id ?? preselectedTaskId ?? ""}
            className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] focus:border-[#22D3EE] focus:outline-none"
          >
            <option value="">{c.pub_noTask}</option>
            {filteredTasks.map((tk) => (
              <option key={tk.id} value={tk.id}>{tk.title}</option>
            ))}
          </select>
        </div>

        {/* Media URL */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--c-text-3)]">{c.pub_mediaUrl}</label>
          <input
            name="media_url"
            type="url"
            defaultValue={post?.media_url ?? ""}
            placeholder="https://drive.google.com/…"
            className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] placeholder-[var(--c-text-3)] focus:border-[#22D3EE] focus:outline-none"
          />
        </div>

        {/* First comment */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--c-text-3)]">
            {c.pub_firstComment}{" "}
            <span className="ml-1 text-[10px] font-normal text-[var(--c-text-3)]">{c.pub_firstCommentHint}</span>
          </label>
          <textarea
            name="first_comment"
            rows={2}
            defaultValue={post?.first_comment}
            placeholder="Hashtags or CTA as first comment…"
            className="w-full resize-none rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] placeholder-[var(--c-text-3)] focus:border-[#22D3EE] focus:outline-none"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--c-text-3)]">{c.pub_notes}</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={post?.notes}
            placeholder="Team instructions, reminders, context…"
            className="w-full resize-none rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] placeholder-[var(--c-text-3)] focus:border-[#22D3EE] focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>
      )}

      <div className="mt-5 flex justify-end gap-2 border-t border-[var(--c-border)] pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="rounded-lg border border-[var(--c-border)] px-4 py-2 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] transition-colors disabled:opacity-50"
        >
          {t.common.cancel}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-medium text-[#071B2C] hover:bg-[#22D3EE]/90 transition-colors disabled:opacity-50"
        >
          {isPending ? t.common.saving : t.common.save}
        </button>
      </div>
    </form>
  );
}

// ─── PostDetail (view mode) ────────────────────────────────────────────────────

function PostDetail({
  post,
  projectClientMap,
  onEdit,
  onClose,
  onSaved,
}: {
  post: SocialPost;
  projectClientMap: Map<string, string>;
  onEdit: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const c = t.contentOS;
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const inferredClient = post.project_id ? projectClientMap.get(post.project_id) : undefined;

  const statusLabel: Record<SocialPostStatus, string> = {
    draft: t.socialMedia.status.draft,
    scheduled: t.socialMedia.status.scheduled,
    published: t.socialMedia.status.published,
    cancelled: t.socialMedia.status.cancelled,
  };

  function handleStatusChange(status: SocialPostStatus) {
    if (status === "published" && !confirm(t.socialMedia.publishConfirm)) return;
    startTransition(async () => {
      await changeSocialPostStatusAction(post.id, status);
      onSaved(); onClose();
    });
  }

  function handleDelete() {
    if (!confirm(t.socialMedia.deleteConfirm)) return;
    const fd = new FormData();
    fd.set("id", post.id);
    startTransition(async () => {
      await deleteSocialPostAction(fd);
      onSaved(); onClose();
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      await duplicateSocialPostAction(post.id);
      onSaved(); onClose();
    });
  }

  function copyContent() {
    const full = [post.content, post.hashtags].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PlatformChips platforms={post.platforms} />
        <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", STATUS_COLORS[post.status])}>
          {statusLabel[post.status]}
        </span>
      </div>

      {post.scheduled_at && (
        <div className="flex items-center gap-2 rounded-xl bg-[#22D3EE]/8 px-3 py-2 text-xs text-[#22D3EE]">
          <span>📅</span>
          <span className="font-medium">{fmtDate(post.scheduled_at)}</span>
          {post.published_at && (
            <span className="ml-auto text-emerald-400">
              ✓ {c.pub_publishedAt} {fmtDateShort(post.published_at)}
            </span>
          )}
        </div>
      )}

      {post.content && (
        <div className="group relative rounded-xl bg-[var(--c-elevated)] p-3">
          <p className="whitespace-pre-wrap text-sm text-[var(--c-text-2)]">{post.content}</p>
          <button
            type="button"
            onClick={copyContent}
            className="absolute right-2 top-2 rounded-md px-2 py-0.5 text-[10px] text-[var(--c-text-3)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--c-card)] hover:text-[var(--c-text-1)]"
          >
            {copied ? c.pub_copied : c.pub_copy}
          </button>
        </div>
      )}

      {post.hashtags && (
        <p className="rounded-xl bg-[var(--c-card)] px-3 py-2 text-xs text-[#22D3EE]/80">{post.hashtags}</p>
      )}

      {post.first_comment && (
        <div className="rounded-xl border border-[var(--c-border)] px-3 py-2">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--c-text-3)]">
            {c.pub_firstCommentLabel}
          </p>
          <p className="whitespace-pre-wrap text-xs text-[var(--c-text-2)]">{post.first_comment}</p>
        </div>
      )}

      {post.media_url && (
        <a
          href={post.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl bg-[var(--c-elevated)] px-3 py-2 text-xs text-[#22D3EE] hover:underline"
        >
          🖼 <span className="truncate">{post.media_url}</span>
        </a>
      )}

      {(post.project_name || post.task_title || inferredClient) && (
        <div className="space-y-1">
          {inferredClient && (
            <p className="text-xs text-[var(--c-text-3)]">
              👥 <span className="font-medium text-[var(--c-text-2)]">{inferredClient}</span>
            </p>
          )}
          {post.project_name && (
            <p className="text-xs text-[var(--c-text-3)]">
              📁 {post.project_name}
              {post.task_title && <> › ✓ {post.task_title}</>}
            </p>
          )}
        </div>
      )}

      {post.notes && (
        <div className="rounded-xl border border-dashed border-[var(--c-border)] px-3 py-2">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--c-text-3)]">
            {c.pub_internalNotes}
          </p>
          <p className="whitespace-pre-wrap text-xs text-[var(--c-text-2)]">{post.notes}</p>
        </div>
      )}

      {post.creator_name && (
        <p className="text-[11px] text-[var(--c-text-3)]">👤 {post.creator_name}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--c-border)] pt-3">
        {post.status !== "published" && post.status !== "cancelled" && (
          <>
            <button
              onClick={() => handleStatusChange("published")}
              disabled={isPending}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              ✓ {c.pub_markPublished}
            </button>
            <button
              onClick={() => handleStatusChange("scheduled")}
              disabled={isPending || post.status === "scheduled"}
              className="rounded-lg border border-[var(--c-border)] px-3 py-1.5 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] disabled:opacity-50"
            >
              📅 {c.pub_schedule}
            </button>
            <button
              onClick={() => handleStatusChange("cancelled")}
              disabled={isPending}
              className="rounded-lg border border-[var(--c-border)] px-3 py-1.5 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] disabled:opacity-50"
            >
              {t.common.cancel}
            </button>
          </>
        )}
        {post.status === "cancelled" && (
          <button
            onClick={() => handleStatusChange("draft")}
            disabled={isPending}
            className="rounded-lg border border-[var(--c-border)] px-3 py-1.5 text-sm text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] disabled:opacity-50"
          >
            ↩ {c.pub_backToDraft}
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleDuplicate}
            disabled={isPending}
            className="rounded-lg px-2 py-1 text-xs text-[var(--c-text-3)] hover:bg-[var(--c-elevated)] hover:text-[var(--c-text-1)]"
          >
            ⧉ {c.pub_duplicate}
          </button>
          <button
            onClick={onEdit}
            disabled={isPending}
            className="rounded-lg px-2 py-1 text-xs text-[var(--c-text-3)] hover:bg-[var(--c-elevated)] hover:text-[var(--c-text-1)]"
          >
            ✏ {t.common.edit}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
          >
            {t.common.delete}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "flex max-h-[90vh] flex-col rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] shadow-2xl",
          wide ? "w-full max-w-2xl" : "w-full max-w-lg",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--c-border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--c-text-1)]">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--c-text-3)] hover:bg-[var(--c-elevated)] hover:text-[var(--c-text-1)]"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PublishingClient({ posts, projects, tasks, clients, preselectedTaskId }: Props) {
  const { t } = useI18n();
  const c = t.contentOS;

  // Build project → client name map
  const projectClientMap = new Map<string, string>();
  for (const proj of projects) {
    if (proj.client_id) {
      const client = clients.find((cl) => cl.id === proj.client_id);
      if (client) projectClientMap.set(proj.id, client.name);
    }
  }

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  // Default to "list" — safe on mobile, no hydration mismatch, user can switch to calendar
  const [view, setView] = useState<"calendar" | "list">("list");
  const [filterPlatform, setFP] = useState("");
  const [filterStatus, setFS] = useState("");
  const [filterClient, setFC] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | "view" | null>(null);
  const [selectedPost, setPost] = useState<SocialPost | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (preselectedTaskId) setModal("create");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSaved() { startTransition(() => {}); }
  function openCreate(date?: string) { setPost(null); setDefaultDate(date); setModal("create"); }
  function openView(p: SocialPost) { setPost(p); setModal("view"); }
  function openEdit(p: SocialPost) { setPost(p); setModal("edit"); }
  function closeModal() { setModal(null); setPost(null); }

  const monthNames = c.months;

  const calDays = buildCalendarDays(year, month);
  const todayKey = toDateKey(today);
  const postsByDate: Record<string, SocialPost[]> = {};
  for (const p of posts) {
    if (!p.scheduled_at) continue;
    const key = p.scheduled_at.slice(0, 10);
    (postsByDate[key] ??= []).push(p);
  }

  const statusLabel: Record<SocialPostStatus, string> = {
    draft: t.socialMedia.status.draft,
    scheduled: t.socialMedia.status.scheduled,
    published: t.socialMedia.status.published,
    cancelled: t.socialMedia.status.cancelled,
  };

  const filtered = posts.filter((p) => {
    if (filterPlatform && !p.platforms.includes(filterPlatform)) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterClient) {
      const clientName = p.project_id ? projectClientMap.get(p.project_id) : undefined;
      if (clientName !== filterClient) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!p.title.toLowerCase().includes(q) && !p.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const unscheduledDrafts = filtered.filter((p) => p.status === "draft" && !p.scheduled_at);

  const total = posts.length;
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const published = posts.filter((p) => p.status === "published").length;
  const drafts = posts.filter((p) => p.status === "draft").length;

  const hasActiveFilters = !!(filterPlatform || filterStatus || filterClient || search);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/content"
            className="flex items-center gap-1 text-sm text-[var(--c-text-3)] hover:text-[var(--c-text-1)] transition-colors"
          >
            <ChevronLeft size={14} />
            {c.title}
          </Link>
          <h1 className="text-xl font-bold text-[var(--c-text-1)]">{c.publishingTitle}</h1>
        </div>
        <button
          onClick={() => openCreate()}
          className="rounded-lg bg-[#22D3EE] px-3 py-2 text-sm font-medium text-[#071B2C] hover:bg-[#22D3EE]/90 transition-colors"
        >
          {c.newPost}
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: c.totalPosts, value: total, accent: "#22D3EE" },
          { label: c.scheduledPosts, value: scheduled, accent: "#22D3EE" },
          { label: c.publishedPosts, value: published, accent: "#22C55E" },
          { label: c.draftPosts, value: drafts, accent: "#64748B" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
            <span className="text-xs text-[var(--c-text-3)]">{s.label}</span>
            <span className="text-2xl font-bold" style={{ color: s.accent }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View toggle */}
        <div className="flex rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-0.5">
          <button
            onClick={() => setView("list")}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-medium transition-all",
              view === "list"
                ? "bg-[#22D3EE] text-[#071B2C] shadow-sm"
                : "text-[var(--c-text-3)] hover:text-[var(--c-text-1)]",
            )}
          >
            {c.pub_listView}
          </button>
          <button
            onClick={() => setView("calendar")}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-medium transition-all",
              view === "calendar"
                ? "bg-[#22D3EE] text-[#071B2C] shadow-sm"
                : "text-[var(--c-text-3)] hover:text-[var(--c-text-1)]",
            )}
          >
            {c.calendar}
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.common.search + "…"}
          className="h-8 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-xs text-[var(--c-text-1)] placeholder-[var(--c-text-3)] focus:border-[#22D3EE] focus:outline-none"
        />

        <select
          value={filterPlatform}
          onChange={(e) => setFP(e.target.value)}
          className="h-8 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-2 text-xs text-[var(--c-text-1)] focus:border-[#22D3EE] focus:outline-none"
        >
          <option value="">{t.socialMedia.allPlatforms}</option>
          {ALL_PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFS(e.target.value)}
          className="h-8 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-2 text-xs text-[var(--c-text-1)] focus:border-[#22D3EE] focus:outline-none"
        >
          <option value="">{t.socialMedia.allStatuses}</option>
          {(["draft", "scheduled", "published", "cancelled"] as SocialPostStatus[]).map((s) => (
            <option key={s} value={s}>{statusLabel[s]}</option>
          ))}
        </select>

        {clients.length > 0 && (
          <select
            value={filterClient}
            onChange={(e) => setFC(e.target.value)}
            className="h-8 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-2 text-xs text-[var(--c-text-1)] focus:border-[#22D3EE] focus:outline-none"
          >
            <option value="">{c.pub_allClients}</option>
            {clients.map((cl) => (
              <option key={cl.id} value={cl.name}>{cl.name}</option>
            ))}
          </select>
        )}

        {hasActiveFilters && (
          <button
            onClick={() => { setFP(""); setFS(""); setFC(""); setSearch(""); }}
            className="text-xs text-[var(--c-text-3)] hover:text-[var(--c-text-1)]"
          >
            ✕ {t.common.clear}
          </button>
        )}
      </div>

      {/* ── Calendar view ── */}
      {view === "calendar" && (
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--c-border)] px-5 py-4">
            <button
              onClick={() => month === 0 ? (setMonth(11), setYear((y) => y - 1)) : setMonth((m) => m - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--c-border)] text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <h3 className="text-sm font-semibold text-[var(--c-text-1)]">
              {monthNames[month]} {year}
            </h3>
            <button
              onClick={() => month === 11 ? (setMonth(0), setYear((y) => y + 1)) : setMonth((m) => m + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--c-border)] text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-[var(--c-border)]">
            {c.weekdaysShort.map((d) => (
              <div key={d} className="py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--c-text-3)]">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              if (!day) {
                return <div key={`e-${i}`} className="min-h-[88px] border-b border-r border-[var(--c-border)] bg-[var(--c-elevated)]/30" />;
              }
              const key = toDateKey(day);
              const dayPosts = (postsByDate[key] ?? []).filter(
                (p) =>
                  (!filterPlatform || p.platforms.includes(filterPlatform)) &&
                  (!filterStatus || p.status === filterStatus) &&
                  (!filterClient || (p.project_id ? projectClientMap.get(p.project_id) === filterClient : false)) &&
                  (!search || p.title.toLowerCase().includes(search.toLowerCase())),
              );
              const isToday = key === todayKey;
              const col = i % 7;
              const isLastCol = col === 6;
              return (
                <div
                  key={key}
                  onClick={() => openCreate(key)}
                  className={cn(
                    "min-h-[88px] cursor-pointer p-1.5 border-b border-[var(--c-border)] flex flex-col gap-1 transition-colors hover:bg-[var(--c-elevated)]/50",
                    !isLastCol && "border-r",
                    isToday && "bg-[#22D3EE]/5",
                  )}
                >
                  <span className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday ? "bg-[#22D3EE] text-[#071B2C]" : "text-[var(--c-text-3)]",
                  )}>
                    {day.getDate()}
                  </span>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map((p) => (
                      <PostChip key={p.id} post={p} onClick={() => openView(p)} />
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="px-1 text-[9px] text-[var(--c-text-3)]">+{dayPosts.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Platform legend */}
          <div className="flex flex-wrap gap-2 border-t border-[var(--c-border)] px-4 py-3">
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setFP(filterPlatform === p.id ? "" : p.id)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-all",
                  filterPlatform === p.id
                    ? `bg-gradient-to-r ${p.color} text-white`
                    : "text-[var(--c-text-3)] hover:text-[var(--c-text-1)]",
                )}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── List view ── */}
      {view === "list" && (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] px-6 py-10 text-center">
              <p className="text-sm text-[var(--c-text-3)]">{c.noPostsMonth}</p>
            </div>
          )}
          {filtered.map((p) => {
            const clientName = p.project_id ? projectClientMap.get(p.project_id) : undefined;
            return (
              <div
                key={p.id}
                className="group rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] px-4 py-3 transition-all hover:border-[#22D3EE]/30"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--c-text-1)]">{p.title}</span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_COLORS[p.status])}>
                        {statusLabel[p.status]}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <PlatformChips platforms={p.platforms} size="xs" />
                    </div>
                    {p.content && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-[var(--c-text-3)]">{p.content}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--c-text-3)]">
                      {p.scheduled_at && <span>📅 {fmtDateShort(p.scheduled_at)}</span>}
                      {clientName && (
                        <span className="rounded-full bg-[#22D3EE]/10 px-1.5 py-0.5 text-[#22D3EE]">
                          👥 {clientName}
                        </span>
                      )}
                      {p.project_name && <span>📁 {p.project_name}</span>}
                      {p.task_title && <span>✓ {p.task_title}</span>}
                    </div>
                  </div>
                  {/* Actions: always visible on mobile, hover-reveal on sm+ */}
                  <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-lg border border-[var(--c-border)] px-2.5 py-1 text-xs text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] hover:text-[var(--c-text-1)] transition-colors"
                    >
                      {t.common.edit}
                    </button>
                    <button
                      onClick={() => openView(p)}
                      className="rounded-lg border border-[var(--c-border)] px-2.5 py-1 text-xs text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] hover:text-[var(--c-text-1)] transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unscheduled drafts */}
      {unscheduledDrafts.length > 0 && (
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--c-text-3)]">
            {c.pub_unscheduledDrafts} ({unscheduledDrafts.length})
          </h4>
          <div className="space-y-1.5">
            {unscheduledDrafts.map((p) => {
              const clientName = p.project_id ? projectClientMap.get(p.project_id) : undefined;
              return (
                <div key={p.id} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[var(--c-elevated)]">
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm text-[var(--c-text-2)]">{p.title}</span>
                    {p.platforms.length > 0 && (
                      <div className="mt-0.5"><PlatformChips platforms={p.platforms} size="xs" /></div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--c-text-3)]">
                    {clientName && <span>{clientName}</span>}
                    {p.project_name && <span>{p.project_name}</span>}
                  </div>
                  <button
                    onClick={() => openEdit(p)}
                    className="shrink-0 rounded-md px-2 py-0.5 text-xs text-[#22D3EE] hover:bg-[#22D3EE]/10"
                  >
                    {c.pub_schedule}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {modal === "create" && (
        <Modal title={c.newPost} onClose={closeModal} wide>
          <PostForm
            projects={projects}
            tasks={tasks}
            projectClientMap={projectClientMap}
            defaultDate={defaultDate}
            preselectedTaskId={preselectedTaskId}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        </Modal>
      )}
      {modal === "edit" && selectedPost && (
        <Modal title={c.pub_editPost} onClose={closeModal} wide>
          <PostForm
            post={selectedPost}
            projects={projects}
            tasks={tasks}
            projectClientMap={projectClientMap}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        </Modal>
      )}
      {modal === "view" && selectedPost && (
        <Modal title={selectedPost.title} onClose={closeModal}>
          <PostDetail
            post={selectedPost}
            projectClientMap={projectClientMap}
            onEdit={() => setModal("edit")}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        </Modal>
      )}
    </div>
  );
}
