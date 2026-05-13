"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";

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

function relative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function labelFor(row: ActivityRow): string {
  const m = row.meta ?? {};
  switch (row.action) {
    case "task_created":
      return "a créé la tâche";
    case "task_assigned":
      return `a assigné la tâche à ${(m.assignee_name as string) ?? "quelqu'un"}`;
    case "task_unassigned":
      return "a retiré l'assignation";
    case "status_changed":
      return `a passé le statut → ${(m.to as string) ?? "?"}`;
    case "priority_changed":
      return `a changé la priorité → ${(m.to as string) ?? "?"}`;
    case "deadline_changed":
      return `a modifié l'échéance`;
    case "comment_added":
      return "a commenté";
    case "comment_deleted":
      return "a supprimé un commentaire";
    case "file_uploaded":
      return `a ajouté ${(m.name as string) ?? "un fichier"}`;
    case "file_deleted":
      return `a supprimé un fichier`;
    case "subtask_added":
      return `a ajouté une sous-tâche`;
    case "subtask_completed":
      return `a terminé une sous-tâche`;
    case "timer_started":
      return "a lancé le timer";
    case "timer_stopped": {
      const sec = (m.duration_seconds as number) ?? 0;
      const h = Math.floor(sec / 3600);
      const mn = Math.floor((sec % 3600) / 60);
      return `a arrêté le timer (${h > 0 ? `${h}h ` : ""}${mn}m)`;
    }
    default:
      return row.action;
  }
}

export function ActivityFeed({ entries }: { entries: ActivityRow[] }) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Activité</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-xs text-ink/45">
            Pas d&apos;activité enregistrée pour cette tâche.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((row) => (
              <li key={row.id} className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <Avatar
                    src={row.actor?.avatar_url ?? null}
                    name={
                      row.actor?.full_name ?? row.actor?.username ?? "?"
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
                    {labelFor(row)}
                  </p>
                  <p className="text-[11px] text-ink/45">
                    {relative(row.created_at)}
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
