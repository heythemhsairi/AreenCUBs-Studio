"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
} from "@/app/dashboard/notifications-actions";

export type NotificationRow = {
  id: string;
  kind: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function relativeTime(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} j`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function iconFor(kind: string): string {
  if (kind === "task_assigned") return "📌";
  if (kind === "task_comment") return "💬";
  if (kind === "task_mentioned") return "@";
  if (kind === "task_review") return "👀";
  if (kind === "task_done") return "✅";
  if (kind === "file_uploaded") return "📎";
  if (kind === "devis_accepted") return "🎉";
  if (kind === "devis_rejected") return "❌";
  if (kind === "devis_paid") return "💰";
  return "🔔";
}

type NotifGroupKind =
  | "task_assigned"
  | "task_comment"
  | "task_mentioned"
  | "task_review"
  | "task_done"
  | "file_uploaded"
  | "devis_accepted"
  | "devis_rejected"
  | "devis_paid";

function pluralFor(
  groupPlural: {
    task_assigned: (n: number) => string;
    task_comment: (n: number) => string;
    task_mentioned: (n: number) => string;
    task_review: (n: number) => string;
    task_done: (n: number) => string;
    file_uploaded: (n: number) => string;
    devis_accepted: (n: number) => string;
    devis_rejected: (n: number) => string;
    devis_paid: (n: number) => string;
    default: (n: number) => string;
  },
  kind: string,
  count: number,
): string {
  const known = [
    "task_assigned",
    "task_comment",
    "task_mentioned",
    "task_review",
    "task_done",
    "file_uploaded",
    "devis_accepted",
    "devis_rejected",
    "devis_paid",
  ] as const;
  if ((known as readonly string[]).includes(kind)) {
    return groupPlural[kind as NotifGroupKind](count);
  }
  return groupPlural.default(count);
}

type Segment =
  | { type: "single"; item: NotificationRow }
  | { type: "group"; kind: string; items: NotificationRow[] };

function segment(items: NotificationRow[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < items.length) {
    let j = i + 1;
    while (j < items.length && items[j].kind === items[i].kind) j++;
    const slice = items.slice(i, j);
    if (slice.length >= 3) {
      out.push({ type: "group", kind: items[i].kind, items: slice });
    } else {
      for (const it of slice) out.push({ type: "single", item: it });
    }
    i = j;
  }
  return out;
}

export function NotificationBell({
  initial,
}: {
  initial: NotificationRow[];
}) {
  const { t } = useI18n();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read_at).length;
  const segments = useMemo(() => segment(items), [items]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onItemClick(n: NotificationRow) {
    if (!n.read_at) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
        ),
      );
      startTransition(async () => {
        await markNotificationReadAction(n.id);
      });
    }
    setOpen(false);
  }

  function onMarkAll() {
    setItems((prev) =>
      prev.map((x) => ({
        ...x,
        read_at: x.read_at ?? new Date().toISOString(),
      })),
    );
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  function onDelete(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    startTransition(async () => {
      await deleteNotificationAction(id);
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#263244] bg-[#111827] text-[#94A3B8] transition-colors hover:border-[#22D3EE]/40 hover:bg-[#1E2A3A] hover:text-[#F8FAFC]"
        aria-label="Notifications"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F43F5E] px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[340px] overflow-hidden rounded-2xl border border-[#263244] bg-[#111827] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between border-b border-[#263244] bg-[#18212F] px-4 py-2.5">
            <p className="text-sm font-semibold text-[#F8FAFC]">
              {t.notifications.title}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                disabled={pending}
                className="text-xs font-semibold text-[#22D3EE] hover:text-[#06B6D4]"
              >
                {t.common.markAllRead}
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[#64748B]">
                {t.notifications.empty}
              </p>
            ) : (
              <ul className="divide-y divide-[#1E293B]">
                {segments.map((seg, idx) => {
                  if (seg.type === "single") {
                    const n = seg.item;
                    return (
                      <li
                        key={n.id}
                        className={cn(
                          "group relative",
                          !n.read_at && "bg-[#22D3EE]/5",
                        )}
                      >
                        <NotificationItem
                          n={n}
                          onClick={() => onItemClick(n)}
                          onDelete={() => onDelete(n.id)}
                        />
                      </li>
                    );
                  }
                  const key = `${seg.kind}-${idx}`;
                  const isExpanded = !!expanded[key];
                  const unreadInGroup = seg.items.filter(
                    (x) => !x.read_at,
                  ).length;
                  return (
                    <li
                      key={key}
                      className={cn(
                        "relative",
                        unreadInGroup > 0 && "bg-[#22D3EE]/5",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((m) => ({ ...m, [key]: !m[key] }))
                        }
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1E2A3A]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22D3EE]/10 text-base">
                          {iconFor(seg.kind)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#F8FAFC]">
                            {pluralFor(
                              t.notifications.groupPlural,
                              seg.kind,
                              seg.items.length,
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#64748B]">
                            {relativeTime(seg.items[0].created_at)}
                            {unreadInGroup > 0 && (
                              <>
                                {" · "}
                                <span className="font-semibold text-[#22D3EE]">
                                  {t.notifications.unread(unreadInGroup)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={cn(
                            "shrink-0 text-[#64748B] transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <ul className="divide-y divide-[#1E293B] border-t border-[#263244] bg-[#0B0F14]/40">
                          {seg.items.map((n) => (
                            <li
                              key={n.id}
                              className={cn(
                                "group relative pl-6",
                                !n.read_at && "bg-[#22D3EE]/5",
                              )}
                            >
                              <NotificationItem
                                n={n}
                                onClick={() => onItemClick(n)}
                                onDelete={() => onDelete(n.id)}
                                compact
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  n,
  onClick,
  onDelete,
  compact,
}: {
  n: NotificationRow;
  onClick: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const inner = (
    <>
      {!compact && (
        <span className="shrink-0 text-base">{iconFor(n.kind)}</span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            compact ? "text-[13px]" : "text-sm",
            "leading-snug",
            n.read_at ? "text-[#94A3B8]" : "font-medium text-[#F8FAFC]",
          )}
        >
          {n.body}
        </p>
        <p className="mt-0.5 text-[11px] text-[#64748B]">
          {relativeTime(n.created_at)}
        </p>
      </div>
      {!n.read_at && (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#22D3EE]" />
      )}
    </>
  );

  return (
    <div className={cn("flex items-start gap-3 px-4 py-3", compact && "py-2")}>
      {n.link ? (
        <Link
          href={n.link}
          onClick={onClick}
          className="flex flex-1 items-start gap-3"
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="flex flex-1 items-start gap-3 text-left"
        >
          {inner}
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 text-xs text-[#3F4C59] opacity-0 transition-opacity hover:text-[#F43F5E] group-hover:opacity-100"
        aria-label="Supprimer"
      >
        ×
      </button>
    </div>
  );
}
