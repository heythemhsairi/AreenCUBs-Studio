"use client";

import { useState, useTransition, useEffect } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  createSocialPostAction,
  updateSocialPostAction,
  deleteSocialPostAction,
  changeSocialPostStatusAction,
  type SocialPlatform,
  type SocialPostStatus,
} from "./actions";

export type SocialPost = {
  id: string;
  title: string;
  content: string;
  platform: SocialPlatform;
  status: SocialPostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  media_url: string | null;
  project_id: string | null;
  task_id: string | null;
  project_name: string | null;
  task_title: string | null;
  created_by: string | null;
  creator_name: string | null;
  created_at: string;
};

type Project = { id: string; name: string };
type Task = { id: string; title: string; project_id: string | null };

type Props = {
  posts: SocialPost[];
  projects: Project[];
  tasks: Task[];
  preselectedTaskId?: string;
};

const PLATFORMS: SocialPlatform[] = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "tiktok",
  "youtube",
];

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500 text-white",
  facebook: "bg-[#1877f2] text-white",
  linkedin: "bg-[#0a66c2] text-white",
  twitter: "bg-[#1da1f2] text-white",
  tiktok: "bg-black text-white",
  youtube: "bg-[#ff0000] text-white",
};

const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  instagram: "📸",
  facebook: "👤",
  linkedin: "💼",
  twitter: "🐦",
  tiktok: "🎵",
  youtube: "▶️",
};

const STATUS_COLORS: Record<SocialPostStatus, string> = {
  draft: "bg-ink/10 text-ink/60",
  scheduled: "bg-brand/15 text-brand",
  published: "bg-green-500/15 text-green-600",
  cancelled: "bg-red-500/15 text-red-500",
};

const WEEKDAYS_FR = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  return date;
}

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

function PostChip({
  post,
  onClick,
}: {
  post: SocialPost;
  onClick: () => void;
}) {
  const platformColor = PLATFORM_COLORS[post.platform];
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80",
        platformColor,
      )}
      title={post.title}
    >
      {PLATFORM_ICONS[post.platform]} {post.title}
    </button>
  );
}

type ModalMode = "create" | "edit" | "view";

function PostModal({
  mode,
  post,
  projects,
  tasks,
  defaultDate,
  preselectedTaskId,
  onClose,
  onSaved,
}: {
  mode: ModalMode;
  post?: SocialPost;
  projects: Project[];
  tasks: Task[];
  defaultDate?: string;
  preselectedTaskId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const sm = t.socialMedia;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Determine preselected project from preselectedTaskId
  const taskFromId = preselectedTaskId
    ? tasks.find((tk) => tk.id === preselectedTaskId)
    : null;
  const initialProject =
    post?.project_id ?? taskFromId?.project_id ?? "";
  const [selectedProject, setSelectedProject] = useState(initialProject);

  const filteredTasks = selectedProject
    ? tasks.filter((tk) => tk.project_id === selectedProject)
    : tasks;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result =
        mode === "edit" && post
          ? await updateSocialPostAction(fd)
          : await createSocialPostAction(fd);
      if (!result.ok) {
        setError(result.error ?? "Error");
      } else {
        onSaved();
        onClose();
      }
    });
  }

  async function handleDelete() {
    if (!post) return;
    if (!confirm(sm.deleteConfirm)) return;
    const fd = new FormData();
    fd.set("id", post.id);
    startTransition(async () => {
      await deleteSocialPostAction(fd);
      onSaved();
      onClose();
    });
  }

  async function handleStatusChange(status: SocialPostStatus) {
    if (!post) return;
    if (status === "published" && !confirm(sm.publishConfirm)) return;
    startTransition(async () => {
      await changeSocialPostStatusAction(post.id, status);
      onSaved();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass w-full max-w-lg rounded-2xl p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">
            {mode === "create"
              ? sm.schedulePost
              : mode === "edit"
                ? t.common.edit
                : post?.title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink/40 hover:bg-white/10 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* View mode: status actions */}
        {mode === "view" && post && (
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  PLATFORM_COLORS[post.platform],
                )}
              >
                {PLATFORM_ICONS[post.platform]} {sm.platform[post.platform]}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                  STATUS_COLORS[post.status],
                )}
              >
                {sm.status[post.status]}
              </span>
            </div>
            {post.scheduled_at && (
              <p className="text-sm text-ink/60">
                📅{" "}
                {new Date(post.scheduled_at).toLocaleString("fr-FR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
            <p className="rounded-xl bg-white/6 p-3 text-sm text-ink/80 whitespace-pre-wrap">
              {post.content || <span className="italic text-ink/35">—</span>}
            </p>
            {post.project_name && (
              <p className="text-xs text-ink/50">
                📁 {post.project_name}
                {post.task_title ? ` › ${post.task_title}` : ""}
              </p>
            )}
            {post.media_url && (
              <p className="text-xs text-brand underline">
                <a href={post.media_url} target="_blank" rel="noopener noreferrer">
                  🖼 {post.media_url}
                </a>
              </p>
            )}
            {post.status !== "published" && post.status !== "cancelled" && (
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => handleStatusChange("published")}
                  disabled={isPending}
                >
                  ✓ Publié
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={isPending}
                >
                  Annuler
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => onClose()}
                  disabled={isPending}
                  className="ml-auto"
                >
                  ✏ {t.common.edit}
                </Button>
              </div>
            )}
            <div className="flex justify-end pt-1">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs text-red-500 hover:underline"
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        )}

        {/* Create / Edit form */}
        {(mode === "create" || mode === "edit") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "edit" && post && (
              <input type="hidden" name="id" value={post.id} />
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-ink/60">
                {sm.form.title} <span className="text-red-400">*</span>
              </label>
              <Input
                name="title"
                required
                defaultValue={post?.title}
                placeholder="Campagne été — Instagram"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink/60">
                {sm.form.platform} <span className="text-red-400">*</span>
              </label>
              <Select name="platform" required defaultValue={post?.platform ?? ""}>
                <option value="" disabled>
                  —
                </option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_ICONS[p]} {sm.platform[p]}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink/60">
                {sm.form.content}
              </label>
              <Textarea
                name="content"
                rows={4}
                defaultValue={post?.content}
                placeholder={sm.form.contentPlaceholder}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink/60">
                {sm.form.scheduledAt}
              </label>
              <Input
                name="scheduled_at"
                type="datetime-local"
                defaultValue={
                  post?.scheduled_at
                    ? new Date(post.scheduled_at)
                        .toISOString()
                        .slice(0, 16)
                    : defaultDate
                      ? `${defaultDate}T09:00`
                      : ""
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink/60">
                {sm.form.mediaUrl}
              </label>
              <Input
                name="media_url"
                type="url"
                defaultValue={post?.media_url ?? ""}
                placeholder="https://…"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink/60">
                {sm.form.project}
              </label>
              <Select
                name="project_id"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">{sm.noProject}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink/60">
                {sm.form.task}
              </label>
              <Select
                name="task_id"
                defaultValue={post?.task_id ?? preselectedTaskId ?? ""}
              >
                <option value="">{sm.noTask}</option>
                {filteredTasks.map((tk) => (
                  <option key={tk.id} value={tk.id}>
                    {tk.title}
                  </option>
                ))}
              </Select>
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onClose}
                disabled={isPending}
              >
                {t.common.cancel}
              </Button>
              <Button variant="primary" size="sm" disabled={isPending}>
                {isPending ? t.common.saving : t.common.save}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function SocialMediaView({ posts, projects, tasks, preselectedTaskId }: Props) {
  const { t } = useI18n();
  const sm = t.socialMedia;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [filterPlatform, setFilterPlatform] = useState<SocialPlatform | "">("");
  const [filterStatus, setFilterStatus] = useState<SocialPostStatus | "">("");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined);
  const [, startTransition] = useTransition();

  // Auto-open create modal when coming from a task link
  useEffect(() => {
    if (preselectedTaskId) {
      setModalMode("create");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh trick: server revalidates, Next.js re-fetches
  function handleSaved() {
    startTransition(() => {});
  }

  const calendarDays = buildCalendarDays(year, month);

  // Map scheduled_at date → posts
  const postsByDate: Record<string, SocialPost[]> = {};
  for (const p of posts) {
    if (!p.scheduled_at) continue;
    const key = p.scheduled_at.slice(0, 10);
    if (!postsByDate[key]) postsByDate[key] = [];
    postsByDate[key].push(p);
  }

  // Filtered list view
  const filteredPosts = posts.filter((p) => {
    if (filterPlatform && p.platform !== filterPlatform) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function openCreate(date?: string) {
    setSelectedPost(null);
    setDefaultDate(date);
    setModalMode("create");
  }

  function openView(post: SocialPost) {
    setSelectedPost(post);
    setModalMode("view");
  }

  const todayKey = toDateKey(today);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={sm.title}
        description={sm.description}
        action={
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            {sm.newPost}
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl bg-white/6 p-0.5">
          {(["calendar", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-medium transition-all",
                view === v
                  ? "bg-brand text-white shadow-sm"
                  : "text-ink/55 hover:text-ink",
              )}
            >
              {v === "calendar" ? sm.calendarView : sm.listView}
            </button>
          ))}
        </div>

        <Select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value as SocialPlatform | "")}
          className="w-44 text-xs"
        >
          <option value="">{sm.allPlatforms}</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_ICONS[p]} {sm.platform[p]}
            </option>
          ))}
        </Select>

        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as SocialPostStatus | "")}
          className="w-40 text-xs"
        >
          <option value="">{sm.allStatuses}</option>
          {(["draft", "scheduled", "published", "cancelled"] as SocialPostStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {sm.status[s]}
              </option>
            ),
          )}
        </Select>
      </div>

      {/* Calendar View */}
      {view === "calendar" && (
        <div className="glass rounded-2xl p-5">
          {/* Month navigation */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="rounded-lg px-3 py-1.5 text-sm text-ink/60 hover:bg-white/10 hover:text-ink"
            >
              ‹
            </button>
            <h3 className="font-semibold text-ink">
              {MONTHS_FR[month]} {year}
            </h3>
            <button
              onClick={nextMonth}
              className="rounded-lg px-3 py-1.5 text-sm text-ink/60 hover:bg-white/10 hover:text-ink"
            >
              ›
            </button>
          </div>

          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS_FR.map((d) => (
              <div
                key={d}
                className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-ink/35"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (!day) {
                return <div key={`empty-${i}`} className="min-h-[80px]" />;
              }
              const key = toDateKey(day);
              const dayPosts = (postsByDate[key] ?? []).filter(
                (p) =>
                  (!filterPlatform || p.platform === filterPlatform) &&
                  (!filterStatus || p.status === filterStatus),
              );
              const isToday = key === todayKey;
              const isCurrentMonth = day.getMonth() === month;

              return (
                <div
                  key={key}
                  className={cn(
                    "group min-h-[80px] cursor-pointer rounded-xl p-1.5 transition-colors",
                    isCurrentMonth
                      ? isToday
                        ? "bg-brand/10 ring-1 ring-brand/40"
                        : "bg-white/4 hover:bg-white/8"
                      : "bg-white/2 opacity-40",
                  )}
                  onClick={() => isCurrentMonth && openCreate(key)}
                >
                  <span
                    className={cn(
                      "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                      isToday
                        ? "bg-brand text-white"
                        : "text-ink/60",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map((p) => (
                      <PostChip
                        key={p.id}
                        post={p}
                        onClick={() => openView(p)}
                      />
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="px-1 text-[9px] text-ink/40">
                        {sm.moreOf(dayPosts.length - 3)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {PLATFORMS.map((p) => (
              <span key={p} className="flex items-center gap-1 text-[11px] text-ink/50">
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-sm",
                    PLATFORM_COLORS[p],
                  )}
                />
                {sm.platform[p]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="space-y-2">
          {filteredPosts.length === 0 && (
            <div className="glass rounded-2xl px-6 py-10 text-center">
              <p className="text-sm text-ink/50">{sm.noPostsMonth}</p>
              <p className="mt-1 text-xs text-ink/35">{sm.noPostsHint}</p>
            </div>
          )}
          {filteredPosts.map((p) => (
            <button
              key={p.id}
              onClick={() => openView(p)}
              className="glass group w-full rounded-xl px-4 py-3 text-left transition-all hover:ring-1 hover:ring-white/20"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm",
                    PLATFORM_COLORS[p.platform],
                  )}
                >
                  {PLATFORM_ICONS[p.platform]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {p.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        STATUS_COLORS[p.status],
                      )}
                    >
                      {sm.status[p.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink/50">
                    {p.content || "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-ink/40">
                    {p.scheduled_at && (
                      <span>
                        📅{" "}
                        {new Date(p.scheduled_at).toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    )}
                    {p.project_name && <span>📁 {p.project_name}</span>}
                    {p.task_title && <span>✓ {p.task_title}</span>}
                    {p.creator_name && <span>👤 {p.creator_name}</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Unscheduled drafts panel */}
      {(() => {
        const drafts = filteredPosts.filter(
          (p) => p.status === "draft" && !p.scheduled_at,
        );
        if (drafts.length === 0) return null;
        return (
          <div className="glass rounded-2xl p-5">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink/40">
              Brouillons non planifiés ({drafts.length})
            </h4>
            <div className="space-y-2">
              {drafts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openView(p)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/6"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs",
                      PLATFORM_COLORS[p.platform],
                    )}
                  >
                    {PLATFORM_ICONS[p.platform]}
                  </span>
                  <span className="flex-1 truncate text-sm text-ink/70">
                    {p.title}
                  </span>
                  <span className="text-xs text-ink/35">{p.project_name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Modal */}
      {modalMode && (
        <PostModal
          mode={
            modalMode === "view" && selectedPost
              ? "view"
              : modalMode === "edit" && selectedPost
                ? "edit"
                : "create"
          }
          post={selectedPost ?? undefined}
          projects={projects}
          tasks={tasks}
          defaultDate={defaultDate}
          preselectedTaskId={preselectedTaskId}
          onClose={() => { setModalMode(null); setSelectedPost(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
