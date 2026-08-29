"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ClientRef = { id: string; name: string } | null;
type ContentItem = {
  id: string;
  title: string;
  content_type: string;
  platform: string;
  status: string;
  priority: string;
  publish_date: string | null;
  client_id: string;
  assigned_to: string | null;
  clients: ClientRef;
};
type Client = { id: string; name: string };
type SocialPostCalendarItem = {
  id: string;
  title: string;
  platforms: string[];
  status: string;
  scheduled_at: string;
};

type Props = {
  items: ContentItem[];
  clients: Client[];
  month: number;
  year: number;
  clientFilter: string | null;
  socialPosts?: SocialPostCalendarItem[];
};

const ITEM_STATUS_BG: Record<string, string> = {
  idea: "bg-surface-3",
  copywriting: "bg-info-weak",
  design: "bg-violet-500/80",
  editing: "bg-warning-weak",
  internal_review: "bg-warning-weak",
  client_review: "bg-danger-weak",
  approved: "bg-success-weak",
  scheduled: "bg-info-weak",
  published: "bg-success-weak",
};

const PLATFORM_ICON: Record<string, string> = {
  instagram: "📸",
  facebook: "👥",
  linkedin: "💼",
  twitter: "🐦",
  tiktok: "🎵",
  youtube: "▶️",
  threads: "🧵",
  pinterest: "📌",
  snapchat: "👻",
  telegram: "✈️",
};

export function ContentCalendarClient({ items, clients, month, year, clientFilter, socialPosts = [] }: Props) {
  const { t } = useI18n();
  const c = t.contentOS;
  const router = useRouter();
  const monthNames = c.months;

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const offset = (firstDayOfWeek + 6) % 7;

  const itemsByDay = new Map<number, ContentItem[]>();
  for (const item of items) {
    if (!item.publish_date) continue;
    const day = new Date(item.publish_date).getDate();
    const arr = itemsByDay.get(day) ?? [];
    arr.push(item);
    itemsByDay.set(day, arr);
  }

  const socialByDay = new Map<number, SocialPostCalendarItem[]>();
  for (const post of socialPosts) {
    const day = new Date(post.scheduled_at).getDate();
    const arr = socialByDay.get(day) ?? [];
    arr.push(post);
    socialByDay.set(day, arr);
  }

  function navigate(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    const params = new URLSearchParams();
    params.set("month", String(newMonth));
    params.set("year", String(newYear));
    if (clientFilter) params.set("client", clientFilter);
    router.push(`/dashboard/content/calendar?${params.toString()}`);
  }

  function handleClientChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams();
    params.set("month", String(month));
    params.set("year", String(year));
    if (e.target.value) params.set("client", e.target.value);
    router.push(`/dashboard/content/calendar?${params.toString()}`);
  }

  const weekdays = c.weekdaysShort;

  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() + 1 === month
    ? today.getDate()
    : null;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/content"
            className="flex items-center gap-1 text-sm text-content-3 hover:text-content transition-colors"
          >
            <ChevronLeft size={14} />
            {c.title}
          </Link>
          <h1 className="text-xl font-bold text-content">{c.calendarTitle}</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={clientFilter ?? ""}
            onChange={handleClientChange}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-content focus:outline-none focus:border-accent2"
          >
            <option value="">{c.allClients}</option>
            {clients.map((cl) => (
              <option key={cl.id} value={cl.id}>{cl.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-content-2 hover:bg-surface-2 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[160px] text-center text-sm font-semibold text-content">
              {monthNames[month - 1]} {year}
            </span>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-content-2 hover:bg-surface-2 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(ITEM_STATUS_BG).map(([status, bg]) => (
          <span key={status} className="flex items-center gap-1 text-[10px] text-content-3">
            <span className={cn("h-2 w-2 rounded-full", bg)} />
            {c.itemStatus[status as keyof typeof c.itemStatus]}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[10px] text-content-3">
          <span className="h-2 w-2 rounded-full bg-accent2/80" />
          {c.publishing}
        </span>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-line">
          {weekdays.map((d) => (
            <div key={d} className="py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-content-3">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-line bg-surface-2/30" />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dayItems = itemsByDay.get(day) ?? [];
            const daySocial = socialByDay.get(day) ?? [];
            const isToday = day === todayDay;
            const col = (offset + day - 1) % 7;
            const isLastCol = col === 6;
            const totalCount = dayItems.length + daySocial.length;
            const showItems = dayItems.slice(0, daySocial.length > 0 ? 2 : 3);
            const showSocial = daySocial.slice(0, Math.max(1, 3 - showItems.length));
            const overflow = totalCount - showItems.length - showSocial.length;

            return (
              <div
                key={day}
                className={cn(
                  "min-h-[100px] p-1.5 border-b border-line flex flex-col gap-1",
                  !isLastCol && "border-r",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday
                        ? "bg-accent2 text-accent2-fg"
                        : "text-content-3",
                    )}
                  >
                    {day}
                  </span>
                  {totalCount > 0 && (
                    <span className="text-[9px] font-semibold text-content-3">
                      {totalCount}
                    </span>
                  )}
                </div>

                {showItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dashboard/content/items/${item.id}`}
                    className={cn(
                      "group flex items-center gap-1 rounded px-1.5 py-1 text-[10px] leading-tight text-white transition-opacity hover:opacity-80",
                      ITEM_STATUS_BG[item.status] ?? "bg-surface-3",
                    )}
                  >
                    <span className="shrink-0">{PLATFORM_ICON[item.platform] ?? "📄"}</span>
                    <span className="truncate flex-1">{item.title}</span>
                  </Link>
                ))}

                {showSocial.map((post) => (
                  <Link
                    key={post.id}
                    href="/dashboard/content/publishing"
                    className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] leading-tight text-white bg-accent2/80 transition-opacity hover:opacity-80"
                  >
                    <span className="shrink-0">{PLATFORM_ICON[post.platforms[0] ?? ""] ?? "📤"}</span>
                    <span className="truncate flex-1">{post.title}</span>
                  </Link>
                ))}

                {overflow > 0 && (
                  <span className="text-[9px] text-content-3 pl-1">
                    +{overflow}
                  </span>
                )}
              </div>
            );
          })}

          {(() => {
            const totalCells = offset + daysInMonth;
            const remainder = totalCells % 7;
            if (remainder === 0) return null;
            const trailing = 7 - remainder;
            return Array.from({ length: trailing }).map((_, i) => (
              <div key={`trail-${i}`} className="min-h-[100px] border-b border-r border-line bg-surface-2/30" />
            ));
          })()}
        </div>
      </div>

      {items.length === 0 && socialPosts.length === 0 && (
        <p className="text-center text-sm text-content-3">{c.calendarEmpty}</p>
      )}
    </div>
  );
}
