"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type LinkedPost = {
  id: string;
  title: string;
  platforms: string[];
  status: string;
  scheduled_at: string | null;
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸", facebook: "👤", linkedin: "💼",
  twitter: "🐦", tiktok: "🎵", youtube: "▶️",
  threads: "🧵", pinterest: "📌", snapchat: "👻", telegram: "✈️",
};

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-ink/10 text-ink/60",
  scheduled: "bg-brand/15 text-brand",
  published: "bg-green-500/15 text-green-600",
  cancelled: "bg-red-500/15 text-red-500",
};

const STATUS_FR: Record<string, string> = {
  draft: "Brouillon", scheduled: "Planifié",
  published: "Publié", cancelled: "Annulé",
};

function platformIcons(platforms: string[]) {
  return platforms.map((id) => PLATFORM_ICONS[id] ?? "📤").join(" ");
}

type Props = {
  taskId: string;
  posts: LinkedPost[];
  canSchedule: boolean;
};

export function LinkedSocialPosts({ taskId, posts, canSchedule }: Props) {
  if (posts.length === 0 && !canSchedule) return null;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/40">
          📱 Posts Social Media liés
        </h3>
        {canSchedule && (
          <Link
            href={`/dashboard/social-media?task_id=${taskId}`}
            className="rounded-lg bg-brand/10 px-3 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/20"
          >
            + Planifier un post
          </Link>
        )}
      </div>

      {posts.length === 0 ? (
        <p className="text-xs text-ink/35">Aucun post lié à cette tâche.</p>
      ) : (
        <div className="space-y-1.5">
          {posts.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-lg bg-white/4 px-3 py-2"
            >
              <span className="shrink-0 text-sm">{platformIcons(p.platforms)}</span>
              <span className="flex-1 truncate text-sm text-ink/80">{p.title}</span>
              <span className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                STATUS_COLORS[p.status] ?? "bg-ink/10 text-ink/60",
              )}>
                {STATUS_FR[p.status] ?? p.status}
              </span>
              {p.scheduled_at && (
                <span className="shrink-0 text-[11px] text-ink/40">
                  {new Date(p.scheduled_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
