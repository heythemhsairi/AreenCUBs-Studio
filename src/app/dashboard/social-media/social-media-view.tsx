"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  createSocialPostAction,
  updateSocialPostAction,
  deleteSocialPostAction,
  duplicateSocialPostAction,
  changeSocialPostStatusAction,
  type SocialPlatform,
  type SocialPostStatus,
} from "./actions";

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

type Project = { id: string; name: string };
type Task = { id: string; title: string; project_id: string | null };

type Props = {
  posts: SocialPost[];
  projects: Project[];
  tasks: Task[];
  preselectedTaskId?: string;
};

// ─── Platform config ──────────────────────────────────────────────────────────

export const ALL_PLATFORMS: { id: SocialPlatform; label: string; icon: string; color: string; charLimit: number }[] = [
  { id: "instagram",  label: "Instagram",   icon: "📸", color: "from-purple-500 to-pink-500",  charLimit: 2200  },
  { id: "facebook",   label: "Facebook",    icon: "👤", color: "from-[#1877f2] to-[#0e5bbd]",  charLimit: 63206 },
  { id: "linkedin",   label: "LinkedIn",    icon: "💼", color: "from-[#0a66c2] to-[#064d93]",  charLimit: 3000  },
  { id: "twitter",    label: "Twitter / X", icon: "🐦", color: "from-[#1da1f2] to-[#0d7ab5]",  charLimit: 280   },
  { id: "tiktok",     label: "TikTok",      icon: "🎵", color: "from-black to-[#222]",         charLimit: 2200  },
  { id: "youtube",    label: "YouTube",     icon: "▶️", color: "from-[#ff0000] to-[#c00]",     charLimit: 5000  },
  { id: "threads",    label: "Threads",     icon: "🧵", color: "from-[#101010] to-[#333]",     charLimit: 500   },
  { id: "pinterest",  label: "Pinterest",   icon: "📌", color: "from-[#e60023] to-[#ad081b]",  charLimit: 500   },
  { id: "snapchat",   label: "Snapchat",    icon: "👻", color: "from-[#fffc00] to-[#e6e300]",  charLimit: 250   },
  { id: "telegram",   label: "Telegram",    icon: "✈️", color: "from-[#2ca5e0] to-[#1a85b8]",  charLimit: 4096  },
];

function getPlatform(id: string) {
  return ALL_PLATFORMS.find((p) => p.id === id) ?? {
    id, label: id, icon: "📤",
    color: "from-ink/30 to-ink/20", charLimit: 999,
  };
}

const STATUS_COLORS: Record<SocialPostStatus, string> = {
  draft:     "bg-ink/10 text-ink/60",
  scheduled: "bg-brand/15 text-brand",
  published: "bg-green-500/15 text-green-600",
  cancelled: "bg-red-500/15 text-red-500",
};

const STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: "Brouillon", scheduled: "Planifié",
  published: "Publié", cancelled: "Annulé",
};

const WEEKDAYS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const MONTHS   = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
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
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

// ─── PlatformPicker ───────────────────────────────────────────────────────────

function PlatformPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
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
                : "border-ink/10 bg-white/4 text-ink/50 hover:border-ink/20 hover:text-ink",
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

function CharCounter({ text, platforms }: { text: string; platforms: string[] }) {
  if (platforms.length === 0) return null;
  const limits = platforms.map((id) => getPlatform(id).charLimit);
  const minLimit = Math.min(...limits);
  const len = text.length;
  const pct = Math.min(len / minLimit, 1);
  const color = pct > 0.95 ? "text-red-500" : pct > 0.8 ? "text-amber-500" : "text-ink/40";
  return (
    <span className={cn("text-[10px] tabular-nums", color)}>
      {len} / {minLimit}
      {platforms.length > 1 && (
        <span className="ml-1 text-ink/30">(limite la plus basse)</span>
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
        "group w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80",
        `bg-gradient-to-r ${first.color} text-white`,
      )}
      title={post.title}
    >
      {post.platforms.slice(0, 2).map((id) => getPlatform(id).icon).join("")}{" "}
      {post.title}
    </button>
  );
}

// ─── PostForm ─────────────────────────────────────────────────────────────────

function PostForm({
  post,
  projects,
  tasks,
  defaultDate,
  preselectedTaskId,
  onClose,
  onSaved,
}: {
  post?: SocialPost;
  projects: Project[];
  tasks: Task[];
  defaultDate?: string;
  preselectedTaskId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
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
  const [tab, setTab] = useState<"main" | "extra">("main");

  const filteredTasks = selectedProject
    ? tasks.filter((tk) => tk.project_id === selectedProject)
    : tasks;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedPlatforms.length === 0) {
      setError("Sélectionnez au moins une plateforme.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    // append platforms as multiple values
    fd.delete("platforms");
    selectedPlatforms.forEach((p) => fd.append("platforms", p));
    startTransition(async () => {
      const result = post
        ? await updateSocialPostAction(fd)
        : await createSocialPostAction(fd);
      if (!result.ok) setError(result.error ?? "Erreur");
      else { onSaved(); onClose(); }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">
      {post && <input type="hidden" name="id" value={post.id} />}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-white/6 p-0.5">
        {(["main", "extra"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-medium transition-all",
              tab === t ? "bg-brand text-white shadow-sm" : "text-ink/50 hover:text-ink",
            )}
          >
            {t === "main" ? "Publication" : "Options avancées"}
          </button>
        ))}
      </div>

      {tab === "main" && (
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">
              Titre <span className="text-red-400">*</span>
            </label>
            <Input name="title" required defaultValue={post?.title} placeholder="Ex : Lancement produit été" />
          </div>

          {/* Platform picker */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-ink/60">
                Plateformes <span className="text-red-400">*</span>
              </label>
              {selectedPlatforms.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPlatforms([])}
                  className="text-[10px] text-ink/35 hover:text-ink/60"
                >
                  Tout désélectionner
                </button>
              )}
            </div>
            <PlatformPicker selected={selectedPlatforms} onChange={setSelectedPlatforms} />
            {selectedPlatforms.length > 0 && (
              <p className="mt-1.5 text-[10px] text-ink/40">
                {selectedPlatforms.length} plateforme{selectedPlatforms.length > 1 ? "s" : ""} sélectionnée{selectedPlatforms.length > 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* Content */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-ink/60">Contenu</label>
              <CharCounter text={content} platforms={selectedPlatforms} />
            </div>
            <Textarea
              name="content"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Texte de la publication, appel à l'action…"
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">Hashtags</label>
            <Input
              name="hashtags"
              defaultValue={post?.hashtags}
              placeholder="#marketing #branding #areen"
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">
              Date & heure de publication
            </label>
            <Input
              name="scheduled_at"
              type="datetime-local"
              defaultValue={
                post?.scheduled_at
                  ? new Date(post.scheduled_at).toISOString().slice(0, 16)
                  : defaultDate ? `${defaultDate}T09:00` : ""
              }
            />
          </div>
        </div>
      )}

      {tab === "extra" && (
        <div className="space-y-4">
          {/* Media URL */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">URL du média</label>
            <Input name="media_url" type="url" defaultValue={post?.media_url ?? ""} placeholder="https://drive.google.com/…" />
            <p className="mt-1 text-[10px] text-ink/35">Lien vers l'image ou la vidéo à publier.</p>
          </div>

          {/* First comment */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">
              Premier commentaire
              <span className="ml-1 text-[10px] font-normal text-ink/35">(Instagram, Facebook)</span>
            </label>
            <Textarea
              name="first_comment"
              rows={2}
              defaultValue={post?.first_comment}
              placeholder="Hashtags ou CTA en premier commentaire…"
            />
          </div>

          {/* Project */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">Projet</label>
            <Select name="project_id" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              <option value="">— Aucun projet —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>

          {/* Task */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">Tâche liée</label>
            <Select name="task_id" defaultValue={post?.task_id ?? preselectedTaskId ?? ""}>
              <option value="">— Aucune tâche —</option>
              {filteredTasks.map((tk) => (
                <option key={tk.id} value={tk.id}>{tk.title}</option>
              ))}
            </Select>
          </div>

          {/* Internal notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">Notes internes</label>
            <Textarea
              name="notes"
              rows={3}
              defaultValue={post?.notes}
              placeholder="Instructions pour l'équipe, rappels, contexte…"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isPending}>
          Annuler
        </Button>
        <Button variant="primary" size="sm" disabled={isPending}>
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

// ─── PostDetail (view mode) ────────────────────────────────────────────────────

function PostDetail({
  post,
  onEdit,
  onClose,
  onSaved,
}: {
  post: SocialPost;
  onEdit: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleStatusChange(status: SocialPostStatus) {
    if (status === "published" && !confirm("Marquer ce post comme publié ?")) return;
    startTransition(async () => {
      await changeSocialPostStatusAction(post.id, status);
      onSaved(); onClose();
    });
  }

  function handleDelete() {
    if (!confirm("Supprimer ce post ?")) return;
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
      {/* Platform + status row */}
      <div className="flex flex-wrap items-center gap-2">
        <PlatformChips platforms={post.platforms} />
        <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", STATUS_COLORS[post.status])}>
          {STATUS_LABELS[post.status]}
        </span>
      </div>

      {/* Schedule */}
      {post.scheduled_at && (
        <div className="flex items-center gap-2 rounded-xl bg-brand/8 px-3 py-2 text-xs text-brand">
          <span>📅</span>
          <span className="font-medium">{fmtDate(post.scheduled_at)}</span>
          {post.published_at && (
            <span className="ml-auto text-green-600">✓ publié {fmtDateShort(post.published_at)}</span>
          )}
        </div>
      )}

      {/* Content */}
      {post.content && (
        <div className="group relative rounded-xl bg-white/6 p-3">
          <p className="whitespace-pre-wrap text-sm text-ink/80">{post.content}</p>
          <button
            type="button"
            onClick={copyContent}
            className="absolute right-2 top-2 rounded-md px-2 py-0.5 text-[10px] text-ink/30 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-ink/70"
          >
            {copied ? "✓ Copié" : "Copier"}
          </button>
        </div>
      )}

      {/* Hashtags */}
      {post.hashtags && (
        <p className="rounded-xl bg-white/4 px-3 py-2 text-xs text-brand/80">{post.hashtags}</p>
      )}

      {/* First comment */}
      {post.first_comment && (
        <div className="rounded-xl border border-ink/8 px-3 py-2">
          <p className="mb-0.5 text-[10px] font-medium text-ink/35 uppercase tracking-wider">Premier commentaire</p>
          <p className="text-xs text-ink/70 whitespace-pre-wrap">{post.first_comment}</p>
        </div>
      )}

      {/* Media URL */}
      {post.media_url && (
        <a
          href={post.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl bg-white/4 px-3 py-2 text-xs text-brand hover:underline"
        >
          🖼 <span className="truncate">{post.media_url}</span>
        </a>
      )}

      {/* Project / Task */}
      {(post.project_name || post.task_title) && (
        <p className="text-xs text-ink/45">
          {post.project_name && <>📁 {post.project_name}</>}
          {post.task_title && <> › ✓ {post.task_title}</>}
        </p>
      )}

      {/* Notes */}
      {post.notes && (
        <div className="rounded-xl border border-dashed border-ink/15 px-3 py-2">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-ink/35">Notes internes</p>
          <p className="text-xs text-ink/60 whitespace-pre-wrap">{post.notes}</p>
        </div>
      )}

      {/* Creator */}
      {post.creator_name && (
        <p className="text-[11px] text-ink/35">👤 {post.creator_name}</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-ink/8 pt-3">
        {post.status !== "published" && post.status !== "cancelled" && (
          <>
            <Button variant="primary" size="sm" onClick={() => handleStatusChange("published")} disabled={isPending}>
              ✓ Marquer publié
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStatusChange("scheduled")} disabled={isPending || post.status === "scheduled"}>
              📅 Planifié
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStatusChange("cancelled")} disabled={isPending}>
              Annuler
            </Button>
          </>
        )}
        {post.status === "cancelled" && (
          <Button variant="outline" size="sm" onClick={() => handleStatusChange("draft")} disabled={isPending}>
            ↩ Remettre en brouillon
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleDuplicate} disabled={isPending} title="Dupliquer">
            ⧉ Dupliquer
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} disabled={isPending}>
            ✏ Modifier
          </Button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

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
  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={cn("glass flex max-h-[90vh] flex-col rounded-2xl shadow-2xl", wide ? "w-full max-w-2xl" : "w-full max-w-lg")}>
        <div className="flex shrink-0 items-center justify-between border-b border-ink/8 px-6 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-white/10 hover:text-ink">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function SocialMediaView({ posts, projects, tasks, preselectedTaskId }: Props) {
  const today = new Date();
  const [year, setYear]               = useState(today.getFullYear());
  const [month, setMonth]             = useState(today.getMonth());
  const [view, setView]               = useState<"calendar" | "list">("calendar");
  const [filterPlatform, setFP]       = useState("");
  const [filterStatus, setFS]         = useState("");
  const [search, setSearch]           = useState("");
  const [modal, setModal]             = useState<"create" | "edit" | "view" | null>(null);
  const [selectedPost, setPost]       = useState<SocialPost | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [, startTransition]           = useTransition();

  useEffect(() => {
    if (preselectedTaskId) setModal("create");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSaved() { startTransition(() => {}); }

  function openCreate(date?: string) {
    setPost(null); setDefaultDate(date); setModal("create");
  }
  function openView(p: SocialPost) { setPost(p); setModal("view"); }
  function openEdit(p: SocialPost) { setPost(p); setModal("edit"); }
  function closeModal()            { setModal(null); setPost(null); }

  // ── calendar
  const calDays = buildCalendarDays(year, month);
  const todayKey = toDateKey(today);
  const postsByDate: Record<string, SocialPost[]> = {};
  for (const p of posts) {
    if (!p.scheduled_at) continue;
    const key = p.scheduled_at.slice(0, 10);
    (postsByDate[key] ??= []).push(p);
  }

  // ── filtered list
  const filtered = posts.filter((p) => {
    if (filterPlatform && !p.platforms.includes(filterPlatform)) return false;
    if (filterStatus  && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.title.toLowerCase().includes(q) && !p.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const unscheduledDrafts = filtered.filter((p) => p.status === "draft" && !p.scheduled_at);

  function prevMonth() { month === 0  ? (setMonth(11), setYear(y => y-1)) : setMonth(m => m-1); }
  function nextMonth() { month === 11 ? (setMonth(0),  setYear(y => y+1)) : setMonth(m => m+1); }

  // ── stats bar
  const total     = posts.length;
  const scheduled = posts.filter(p => p.status === "scheduled").length;
  const published = posts.filter(p => p.status === "published").length;
  const drafts    = posts.filter(p => p.status === "draft").length;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Social Media"
        description="Planifiez et gérez les publications sur les réseaux sociaux."
        action={
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            + Nouveau post
          </Button>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total",     value: total,     color: "text-ink" },
          { label: "Planifiés", value: scheduled, color: "text-brand" },
          { label: "Publiés",   value: published, color: "text-green-600" },
          { label: "Brouillons",value: drafts,    color: "text-ink/50" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl px-4 py-3 text-center">
            <p className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</p>
            <p className="text-[11px] text-ink/45">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View toggle */}
        <div className="flex rounded-xl bg-white/6 p-0.5">
          {(["calendar", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-medium transition-all",
                view === v ? "bg-brand text-white shadow-sm" : "text-ink/55 hover:text-ink",
              )}
            >
              {v === "calendar" ? "Calendrier" : "Liste"}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="h-8 rounded-lg border border-ink/10 bg-white/6 px-3 text-xs text-ink placeholder-ink/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />

        {/* Platform filter */}
        <Select value={filterPlatform} onChange={(e) => setFP(e.target.value)} className="h-8 w-44 text-xs">
          <option value="">Toutes les plateformes</option>
          {ALL_PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
          ))}
        </Select>

        {/* Status filter */}
        <Select value={filterStatus} onChange={(e) => setFS(e.target.value)} className="h-8 w-36 text-xs">
          <option value="">Tous les statuts</option>
          {(["draft","scheduled","published","cancelled"] as SocialPostStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </Select>

        {(filterPlatform || filterStatus || search) && (
          <button
            onClick={() => { setFP(""); setFS(""); setSearch(""); }}
            className="text-xs text-ink/40 hover:text-ink"
          >
            ✕ Effacer
          </button>
        )}
      </div>

      {/* ── Calendar view ── */}
      {view === "calendar" && (
        <div className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={prevMonth} className="rounded-lg px-3 py-1.5 text-sm text-ink/60 hover:bg-white/10">‹</button>
            <h3 className="font-semibold text-ink">{MONTHS[month]} {year}</h3>
            <button onClick={nextMonth} className="rounded-lg px-3 py-1.5 text-sm text-ink/60 hover:bg-white/10">›</button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-ink/35">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calDays.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="min-h-[88px]" />;
              const key = toDateKey(day);
              const dayPosts = (postsByDate[key] ?? []).filter((p) =>
                (!filterPlatform || p.platforms.includes(filterPlatform)) &&
                (!filterStatus || p.status === filterStatus) &&
                (!search || p.title.toLowerCase().includes(search.toLowerCase())),
              );
              const isToday = key === todayKey;
              const isCurrent = day.getMonth() === month;
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[88px] cursor-pointer rounded-xl p-1.5 transition-colors",
                    isCurrent
                      ? isToday ? "bg-brand/10 ring-1 ring-brand/40" : "bg-white/4 hover:bg-white/8"
                      : "bg-white/2 opacity-30",
                  )}
                  onClick={() => isCurrent && openCreate(key)}
                >
                  <span className={cn(
                    "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                    isToday ? "bg-brand text-white" : "text-ink/55",
                  )}>
                    {day.getDate()}
                  </span>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map((p) => (
                      <PostChip key={p.id} post={p} onClick={() => openView(p)} />
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="px-1 text-[9px] text-ink/40">+{dayPosts.length - 3} de plus</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Platform legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setFP(filterPlatform === p.id ? "" : p.id)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-all",
                  filterPlatform === p.id
                    ? `bg-gradient-to-r ${p.color} text-white`
                    : "text-ink/45 hover:text-ink",
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
            <div className="glass rounded-2xl px-6 py-10 text-center">
              <p className="text-sm text-ink/50">Aucun post trouvé.</p>
              <p className="mt-1 text-xs text-ink/35">Essayez d'élargir les filtres ou créez un nouveau post.</p>
            </div>
          )}
          {filtered.map((p) => (
            <div
              key={p.id}
              className="glass group rounded-xl px-4 py-3 transition-all hover:ring-1 hover:ring-white/20"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{p.title}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_COLORS[p.status])}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <PlatformChips platforms={p.platforms} size="xs" />
                  </div>
                  {p.content && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-ink/50">{p.content}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink/40">
                    {p.scheduled_at && <span>📅 {fmtDateShort(p.scheduled_at)}</span>}
                    {p.project_name  && <span>📁 {p.project_name}</span>}
                    {p.task_title    && <span>✓ {p.task_title}</span>}
                    {p.hashtags      && <span className="text-brand/60 truncate max-w-[160px]">{p.hashtags}</span>}
                  </div>
                </div>
                {/* Inline actions */}
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded-lg px-2 py-1 text-xs text-ink/50 hover:bg-white/10 hover:text-ink"
                    title="Modifier"
                  >
                    ✏
                  </button>
                  <button
                    onClick={() => openView(p)}
                    className="rounded-lg px-2 py-1 text-xs text-ink/50 hover:bg-white/10 hover:text-ink"
                    title="Voir"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Unscheduled drafts ── */}
      {unscheduledDrafts.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink/40">
            Brouillons non planifiés ({unscheduledDrafts.length})
          </h4>
          <div className="space-y-1.5">
            {unscheduledDrafts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/6"
              >
                <div className="flex-1 min-w-0">
                  <span className="truncate text-sm text-ink/70">{p.title}</span>
                  {p.platforms.length > 0 && (
                    <div className="mt-0.5">
                      <PlatformChips platforms={p.platforms} size="xs" />
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-ink/30">{p.project_name}</span>
                <button
                  onClick={() => openEdit(p)}
                  className="shrink-0 rounded-md px-2 py-0.5 text-xs text-brand hover:bg-brand/10"
                >
                  Planifier
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {modal === "create" && (
        <Modal title="Nouveau post" onClose={closeModal} wide>
          <PostForm
            projects={projects}
            tasks={tasks}
            defaultDate={defaultDate}
            preselectedTaskId={preselectedTaskId}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        </Modal>
      )}

      {modal === "edit" && selectedPost && (
        <Modal title="Modifier le post" onClose={closeModal} wide>
          <PostForm
            post={selectedPost}
            projects={projects}
            tasks={tasks}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        </Modal>
      )}

      {modal === "view" && selectedPost && (
        <Modal title={selectedPost.title} onClose={closeModal}>
          <PostDetail
            post={selectedPost}
            onEdit={() => { setModal("edit"); }}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        </Modal>
      )}
    </div>
  );
}
