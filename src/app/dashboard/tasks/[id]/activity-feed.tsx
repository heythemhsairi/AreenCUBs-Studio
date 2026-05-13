"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { useI18n } from "@/lib/i18n/provider";
import type { Dict } from "@/lib/i18n/dictionary";

export type ActivityRow = {
  id: string;
  action: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  actor: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

const ACTION_ICON: Record<string, string> = {
  task_created: "✨",
  task_assigned: "👤",
  task_unassigned: "🚫",
  status_changed: "🔄",
  priority_changed: "🎯",
  deadline_changed: "📅",
  comment_added: "💬",
  comment_deleted: "🗑️",
  file_uploaded: "📎",
  file_deleted: "🗑️",
  subtask_added: "➕",
  subtask_completed: "✅",
  timer_started: "▶️",
  timer_stopped: "⏹️",
};

function relative(iso: string, t: Dict, locale: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t.taskDetail.now;
  if (m < 60) return t.taskDetail.minsAgo(m);
  const h = Math.floor(m / 60);
  if (h < 24) return t.taskDetail.hoursAgo(h);
  return d.toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function labelFor(row: ActivityRow, t: Dict): string {
  const m = row.meta ?? {};
  const A = t.taskDetail.action;
  switch (row.action) {
    case "task_created":
      return A.task_created;
    case "task_assigned":
      return A.task_assigned(
        (m.assignee_name as string) ?? t.taskDetail.someone,
      );
    case "task_unassigned":
      return A.task_unassigned;
    case "status_changed":
      return A.status_changed(
        (m.to as string) ?? t.taskDetail.questionMark,
      );
    case "priority_changed":
      return A.priority_changed(
        (m.to as string) ?? t.taskDetail.questionMark,
      );
    case "deadline_changed":
      return A.deadline_changed;
    case "comment_added":
      return A.comment_added;
    case "comment_deleted":
      return A.comment_deleted;
    case "file_uploaded":
      return A.file_uploaded(
        (m.name as string) ?? A.file_uploadedNamed,
      );
    case "file_deleted":
      return A.file_deleted;
    case "subtask_added":
      return A.subtask_added;
    case "subtask_completed":
      return A.subtask_completed;
    case "timer_started":
      return A.timer_started;
    case "timer_stopped": {
      const sec = (m.duration_seconds as number) ?? 0;
      const h = Math.floor(sec / 3600);
      const mn = Math.floor((sec % 3600) / 60);
      return A.timer_stopped(h, mn);
    }
    default:
      return row.action;
  }
}

export function ActivityFeed({ entries }: { entries: ActivityRow[] }) {
  const { t, locale } = useI18n();
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t.taskDetail.activity}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-xs text-ink/45">{t.taskDetail.noActivity}</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((row) => (
              <li key={row.id} className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <Avatar
                    src={row.actor?.avatar_url ?? null}
                    name={
                      row.actor?.full_name ??
                      row.actor?.username ??
                      t.taskDetail.questionMark
                    }
                    size="sm"
                  />
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] shadow-soft dark:bg-[#1c1f29]">
                    {ACTION_ICON[row.action] ?? "•"}
                  </span>
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm text-ink/80">
                    <span className="font-medium text-ink">
                      {row.actor?.full_name ?? row.actor?.username ?? "—"}
                    </span>{" "}
                    {labelFor(row, t)}
                  </p>
                  <p className="text-[11px] text-ink/45">
                    {relative(row.created_at, t, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
