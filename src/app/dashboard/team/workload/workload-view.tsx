"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/provider";

export type OverdueTask = {
  id: string;
  title: string;
  deadline: string;
  days_late: number;
  project: string;
  isAdminTask?: boolean;
};

export type MemberStats = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  job_title: string | null;
  active: number;
  overdue: number;
  done_month: number;
  in_progress: number;
  review: number;
  total_tracked_seconds: number;
  projects: string[];
  overdue_tasks: OverdueTask[];
  admin_tasks_active: number;
};

export type Summary = {
  mostLoaded: MemberStats | null;
  withOverdue: MemberStats[];
  unassigned: MemberStats[];
  needsReview: MemberStats[];
};

const OVERLOAD_THRESHOLD = 8;

function fmtTime(seconds: number): string {
  if (seconds < 60) return "< 1m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function Avatar({ member }: { member: Pick<MemberStats, "avatar_url" | "full_name" | "username"> }) {
  const initials = (member.full_name ?? member.username)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (member.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar_url}
        alt={member.full_name ?? member.username}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent2/15 text-xs font-bold text-accent2">
      {initials}
    </div>
  );
}

function LoadBar({ active, max }: { active: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min((active / max) * 100, 100);
  const color =
    active >= OVERLOAD_THRESHOLD
      ? "bg-danger"
      : active >= OVERLOAD_THRESHOLD * 0.7
        ? "bg-warning"
        : "bg-success";
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-3">
      <div className={cn("h-1.5 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function WorkloadView({
  members,
  summary,
  today,
}: {
  members: MemberStats[];
  summary: Summary;
  today: string;
}) {
  const { t } = useI18n();
  const tf = t.finance;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const maxActive = Math.max(...members.map((m) => m.active), 1);

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile
          label={tf.workloadMostLoaded}
          value={summary.mostLoaded?.full_name ?? "—"}
          sub={tf.workloadActiveTasks(summary.mostLoaded?.active ?? 0)}
          tone={(summary.mostLoaded?.active ?? 0) >= OVERLOAD_THRESHOLD ? "red" : "neutral"}
        />
        <SummaryTile
          label={t.filters.overdue}
          value={`${summary.withOverdue.length} ${t.nav.team.toLowerCase()}`}
          sub={tf.workloadNoTasks(summary.withOverdue.reduce((s, m) => s + m.overdue, 0))}
          tone={summary.withOverdue.length > 0 ? "red" : "green"}
        />
        <SummaryTile
          label={t.tasks.status.review}
          value={`${summary.needsReview.length} ${t.nav.team.toLowerCase()}`}
          sub={tf.workloadNoTasks(summary.needsReview.reduce((s, m) => s + m.review, 0))}
          tone={summary.needsReview.length > 0 ? "amber" : "green"}
        />
        <SummaryTile
          label={tf.workloadNoMembers}
          value={`${summary.unassigned.length} ${t.nav.team.toLowerCase()}`}
          sub={tf.workloadAvailable}
          tone={summary.unassigned.length > 0 ? "slate" : "green"}
        />
      </div>

      {/* Team grid */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line bg-surface-2 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-content-3">
            {tf.workloadTeamHeader(today)}
          </p>
        </div>
        <div className="divide-y divide-surface-2">
          {members.map((m) => {
            const isOverloaded = m.active >= OVERLOAD_THRESHOLD;
            const isExpanded = expandedId === m.id;

            return (
              <div key={m.id}>
                <div
                  className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                >
                  <Avatar member={m} />

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/team/${m.id}`}
                        className="text-sm font-semibold text-content hover:text-accent2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {m.full_name ?? `@${m.username}`}
                      </Link>
                      {m.job_title && (
                        <span className="text-xs text-content-3">{m.job_title}</span>
                      )}
                      {isOverloaded && (
                        <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
                          {tf.workloadOverloaded}
                        </span>
                      )}
                      {m.active === 0 && (
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                          {tf.workloadAvailableBadge}
                        </span>
                      )}
                    </div>

                    <LoadBar active={m.active} max={maxActive} />

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-3">
                      <span>
                        <strong className="text-content">{m.active}</strong> {tf.workloadActive}
                      </span>
                      {m.admin_tasks_active > 0 && (
                        <span className="rounded-md bg-accent2/10 px-1.5 py-0.5 text-[10px] font-medium text-accent2">
                          {m.admin_tasks_active} {tf.workloadAdminTasksBadge}
                        </span>
                      )}
                      {m.in_progress > 0 && (
                        <span>
                          <strong className="text-accent2">{m.in_progress}</strong> {tf.workloadInProgress}
                        </span>
                      )}
                      {m.review > 0 && (
                        <span>
                          <strong className="text-warning">{m.review}</strong> {tf.workloadToValidate}
                        </span>
                      )}
                      {m.overdue > 0 && (
                        <span>
                          <strong className="text-danger">{m.overdue}</strong> {tf.workloadLate}
                        </span>
                      )}
                      <span>
                        <strong className="text-success">{m.done_month}</strong> {tf.workloadDoneMonth}
                      </span>
                      {m.total_tracked_seconds > 0 && (
                        <span>{fmtTime(m.total_tracked_seconds)} {tf.workloadTracked}</span>
                      )}
                    </div>

                    {m.projects.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.projects.slice(0, 5).map((p) => (
                          <span
                            key={p}
                            className="rounded-md bg-accent2/10 px-1.5 py-0.5 text-[10px] font-medium text-accent2"
                          >
                            {p}
                          </span>
                        ))}
                        {m.projects.length > 5 && (
                          <span className="text-[10px] text-content-3">
                            +{m.projects.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <svg
                      className={cn("h-4 w-4 text-content-3 transition-transform", isExpanded && "rotate-180")}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>

                {/* Expanded: overdue tasks detail */}
                {isExpanded && (
                  <div className="border-t border-surface-2 bg-[#0D1117] px-4 pb-4 pt-3">
                    {m.active === 0 ? (
                      <p className="text-sm text-content-3">{tf.workloadNoActive}</p>
                    ) : (
                      <div className="space-y-3">
                        {isOverloaded && (
                          <div className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
                            {tf.workloadOverloadWarning(m.active, OVERLOAD_THRESHOLD)}
                          </div>
                        )}

                        {m.overdue_tasks.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-danger">
                              {tf.workloadOverdueHeader}
                            </p>
                            <div className="space-y-1">
                              {m.overdue_tasks.map((task) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-danger/15 bg-danger/8 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Link
                                        href={task.isAdminTask ? `/dashboard/admin-tasks/${task.id}` : `/dashboard/tasks/${task.id}`}
                                        className="text-sm font-medium text-content hover:text-accent2"
                                      >
                                        {task.title}
                                      </Link>
                                      {task.isAdminTask && (
                                        <span className="rounded-md bg-accent2/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent2">
                                          {tf.workloadAdminTasksBadge}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-content-3">{task.project}</p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <Badge tone="red">+{task.days_late}d</Badge>
                                    <Link
                                      href={task.isAdminTask ? `/dashboard/admin-tasks/${task.id}` : `/dashboard/tasks/${task.id}`}
                                      className="rounded-md bg-accent2/10 px-2 py-1 text-xs font-medium text-accent2 hover:bg-accent2/20"
                                    >
                                      {tf.workloadViewLink}
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {m.overdue_tasks.length === 0 && m.active > 0 && (
                          <p className="text-xs text-content-3">{tf.workloadNoOverdue(m.active)}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Overdue review table */}
      {summary.withOverdue.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line bg-surface-2 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-danger">
              {tf.workloadReviewTitle}
            </p>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <Th>{tf.workloadColTask}</Th>
                    <Th>{tf.workloadColOwner}</Th>
                    <Th>{tf.workloadColProject}</Th>
                    <Th>{tf.workloadColDelay}</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {summary.withOverdue
                    .flatMap((m) => m.overdue_tasks.map((task) => ({ ...task, member: m })))
                    .sort((a, b) => b.days_late - a.days_late)
                    .map((row) => (
                      <tr key={`${row.id}-${row.member.id}`} className="border-b border-surface-2 last:border-0 hover:bg-surface-2">
                        <Td>
                          <div className="flex items-center gap-2">
                            <Link
                              href={row.isAdminTask ? `/dashboard/admin-tasks/${row.id}` : `/dashboard/tasks/${row.id}`}
                              className="font-medium text-content hover:text-accent2"
                            >
                              {row.title}
                            </Link>
                            {row.isAdminTask && (
                              <span className="rounded-md bg-accent2/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent2">
                                {tf.workloadAdminTasksBadge}
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <span className="text-content-3">
                            {row.member.full_name ?? `@${row.member.username}`}
                          </span>
                        </Td>
                        <Td>
                          <span className="text-content-3">{row.project}</span>
                        </Td>
                        <Td>
                          <Badge tone="red">+{row.days_late}d</Badge>
                        </Td>
                        <Td>
                          <Link
                            href={row.isAdminTask ? `/dashboard/admin-tasks/${row.id}` : `/dashboard/tasks/${row.id}`}
                            className="rounded-md bg-accent2/10 px-2 py-1 text-xs font-medium text-accent2 hover:bg-accent2/20"
                          >
                            {tf.workloadOpenLink}
                          </Link>
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, sub, tone }: {
  label: string; value: string; sub: string;
  tone: "red" | "amber" | "green" | "neutral" | "slate";
}) {
  const styles = {
    red:     { card: "border-danger/20 bg-danger/8",  val: "text-danger" },
    amber:   { card: "border-warning/20 bg-warning/8",  val: "text-warning" },
    green:   { card: "border-success/20 bg-success/8",  val: "text-success" },
    slate:   { card: "border-line bg-surface-2",        val: "text-content-3" },
    neutral: { card: "border-line bg-surface",        val: "text-content" },
  }[tone];

  return (
    <div className={cn("rounded-xl border p-3.5", styles.card)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-content-3">{label}</p>
      <p className={cn("mt-1.5 text-lg font-bold", styles.val)}>{value}</p>
      <p className="text-[11px] text-content-3">{sub}</p>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-content-3">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 align-middle text-sm">{children}</td>;
}
