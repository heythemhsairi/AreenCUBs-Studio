"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/provider";
import { togglePriorityPinAction } from "./priority-actions";

type Pin = {
  pinId: string;
  taskId: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  project: string | null;
  client: string | null;
};

const statusTone: Record<string, "slate" | "blue" | "amber" | "green"> = {
  todo: "slate",
  in_progress: "blue",
  review: "amber",
  done: "green",
};

const priorityTone: Record<string, "slate" | "neutral" | "amber" | "red"> = {
  low: "slate",
  normal: "neutral",
  high: "amber",
  urgent: "red",
};

export function PriorityPinsSection({ pins }: { pins: Pin[] }) {
  const { t } = useI18n();
  const [items, setItems] = useState(pins);
  const [, startTransition] = useTransition();

  function relativeDeadline(iso: string | null): string {
    if (!iso) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(iso);
    const days = Math.floor((d.getTime() - today.getTime()) / 86400000);
    if (days < 0) return t.pins.relativeLate(days);
    if (days === 0) return t.pins.relativeToday;
    return t.pins.relativeIn(days);
  }

  function unpin(p: Pin) {
    setItems((prev) => prev.filter((x) => x.pinId !== p.pinId));
    startTransition(async () => {
      await togglePriorityPinAction(p.taskId);
    });
  }

  if (items.length === 0) return null;

  return (
    <Card variant="ring" className="overflow-hidden">
      <div className="rounded-2xl bg-gradient-to-br from-accent/12 via-white/90 to-white/85 dark:from-accent/20 dark:via-[#1c1f29]/85 dark:to-[#1c1f29]/85">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="text-accent">⭐</span>
              {t.pins.title}
              <span className="text-xs font-medium text-ink/40">
                {items.length}
                {t.pins.counterMax}
              </span>
            </CardTitle>
            <Link
              href="/dashboard/tasks"
              className="text-xs font-semibold text-brand hover:text-brand-dark"
            >
              {t.pins.seeMyTasks}
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {items.map((p) => (
              <li key={p.pinId}>
                <div className="group flex items-center gap-3 rounded-lg border border-white/40 bg-white/70 p-2.5 transition-all hover:shadow-soft dark:border-white/10 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={() => unpin(p)}
                    title={t.pins.unpin}
                    aria-label={t.pins.unpin}
                    className="text-accent transition-transform hover:scale-110"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </button>
                  <Link
                    href={`/dashboard/tasks/${p.taskId}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-sm font-medium text-ink hover:text-brand">
                      {p.title}
                    </p>
                    <p className="truncate text-xs text-ink/55">
                      {p.client ? `${p.client} · ` : ""}
                      {p.project ?? "—"}
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <Badge tone={priorityTone[p.priority] ?? "neutral"}>
                      {t.tasks.priority[
                        p.priority as keyof typeof t.tasks.priority
                      ] ?? p.priority}
                    </Badge>
                    <Badge tone={statusTone[p.status] ?? "slate"}>
                      {t.tasks.status[
                        p.status as keyof typeof t.tasks.status
                      ] ?? p.status}
                    </Badge>
                    {p.deadline &&
                      (() => {
                        const dToday = new Date();
                        dToday.setHours(0, 0, 0, 0);
                        const days = Math.floor(
                          (new Date(p.deadline).getTime() -
                            dToday.getTime()) /
                            86400000,
                        );
                        const late = days < 0;
                        return (
                          <span
                            className={`rounded-md px-2 py-0.5 font-semibold ${
                              late
                                ? "bg-red-50 text-red-700"
                                : "bg-accent/15 text-accent-dark"
                            }`}
                          >
                            {relativeDeadline(p.deadline)}
                          </span>
                        );
                      })()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </div>
    </Card>
  );
}
