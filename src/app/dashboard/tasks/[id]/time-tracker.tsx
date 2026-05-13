"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { useI18n } from "@/lib/i18n/provider";
import { startTimerAction, stopTimerAction } from "./time-actions";

export type TimeEntry = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  user: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function TimeTracker({
  taskId,
  entries,
  myRunningEntryId,
  totalSeconds,
}: {
  taskId: string;
  entries: TimeEntry[];
  myRunningEntryId: string | null;
  totalSeconds: number;
}) {
  const { t, locale } = useI18n();
  const isRunning = myRunningEntryId !== null;
  const [pending, startTransition] = useTransition();
  const [tick, setTick] = useState(0);

  // Tick every second so the live timer display stays current
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const runningEntry = entries.find((e) => e.id === myRunningEntryId);
  const liveSeconds = runningEntry
    ? Math.floor(
        (Date.now() - new Date(runningEntry.started_at).getTime()) / 1000,
      )
    : 0;

  function toggle() {
    startTransition(async () => {
      if (isRunning) await stopTimerAction(taskId);
      else await startTimerAction(taskId);
    });
  }

  // Total = stored durations + live running session
  const totalDisplay = totalSeconds + (isRunning ? liveSeconds : 0);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t.taskDetail.timeTrackerTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/55">
              {t.taskDetail.totalTime}
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink">
              {formatDuration(totalDisplay)}
              <span className="hidden">{tick}</span>
            </p>
          </div>
          <Button
            type="button"
            variant={isRunning ? "ink" : "primary"}
            onClick={toggle}
            disabled={pending}
            className="gap-2"
          >
            {isRunning ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                Stop · {formatDuration(liveSeconds)}
              </>
            ) : (
              <>{t.taskDetail.startTimer}</>
            )}
          </Button>
        </div>

        {entries.length > 0 && (
          <ul className="space-y-1.5 border-t border-ink/8 pt-3">
            {entries.slice(0, 8).map((e) => {
              const started = new Date(e.started_at);
              const date = started.toLocaleDateString(
                locale === "en" ? "en-US" : "fr-FR",
                {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              );
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {e.user && (
                      <Avatar
                        src={e.user.avatar_url}
                        name={e.user.full_name ?? e.user.username}
                        size="xs"
                      />
                    )}
                    <span className="truncate text-ink/75">
                      {e.user
                        ? e.user.full_name ?? `@${e.user.username}`
                        : "—"}
                    </span>
                    <span className="shrink-0 text-ink/45">· {date}</span>
                  </div>
                  <span className="shrink-0 font-mono font-semibold text-ink/75">
                    {e.ended_at === null
                      ? t.taskDetail.ongoing
                      : formatDuration(e.duration_seconds ?? 0)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
