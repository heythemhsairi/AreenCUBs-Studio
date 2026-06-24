"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type OverdueTask = {
  id: string;
  title: string;
  deadline: string;
  days_late: number;
  project: string;
};

type MemberStats = {
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
};

type Summary = {
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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#22D3EE]/15 text-xs font-bold text-[#22D3EE]">
      {initials}
    </div>
  );
}

function LoadBar({ active, max }: { active: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min((active / max) * 100, 100);
  const color =
    active >= OVERLOAD_THRESHOLD
      ? "bg-[#F43F5E]"
      : active >= OVERLOAD_THRESHOLD * 0.7
        ? "bg-[#F59E0B]"
        : "bg-[#22C55E]";
  return (
    <div className="h-1.5 w-full rounded-full bg-[#263244]">
      <div
        className={cn("h-1.5 rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const maxActive = Math.max(...members.map((m) => m.active), 1);

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile
          label="Plus chargé"
          value={summary.mostLoaded?.full_name ?? "—"}
          sub={`${summary.mostLoaded?.active ?? 0} tâches actives`}
          tone={(summary.mostLoaded?.active ?? 0) >= OVERLOAD_THRESHOLD ? "red" : "neutral"}
        />
        <SummaryTile
          label="En retard"
          value={`${summary.withOverdue.length} membres`}
          sub={`${summary.withOverdue.reduce((s, m) => s + m.overdue, 0)} tâches`}
          tone={summary.withOverdue.length > 0 ? "red" : "green"}
        />
        <SummaryTile
          label="À valider"
          value={`${summary.needsReview.length} membres`}
          sub={`${summary.needsReview.reduce((s, m) => s + m.review, 0)} tâches`}
          tone={summary.needsReview.length > 0 ? "amber" : "green"}
        />
        <SummaryTile
          label="Sans tâches"
          value={`${summary.unassigned.length} membres`}
          sub="disponibles"
          tone={summary.unassigned.length > 0 ? "slate" : "green"}
        />
      </div>

      {/* Team grid */}
      <div className="overflow-hidden rounded-2xl border border-[#263244] bg-[#111827]">
        <div className="border-b border-[#263244] bg-[#18212F] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Membres de l&apos;équipe — {today}
          </p>
        </div>
        <div className="divide-y divide-[#1E2A3A]">
          {members.map((m) => {
            const isOverloaded = m.active >= OVERLOAD_THRESHOLD;
            const isExpanded = expandedId === m.id;

            return (
              <div key={m.id}>
                <div
                  className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-[#1E2A3A]"
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                >
                  <Avatar member={m} />

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/team/${m.id}`}
                        className="text-sm font-semibold text-[#F8FAFC] hover:text-[#22D3EE]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {m.full_name ?? `@${m.username}`}
                      </Link>
                      {m.job_title && (
                        <span className="text-xs text-[#64748B]">{m.job_title}</span>
                      )}
                      {isOverloaded && (
                        <span className="rounded-full bg-[#F43F5E]/15 px-2 py-0.5 text-[10px] font-semibold text-[#F43F5E]">
                          ⚠ Surchargé
                        </span>
                      )}
                      {m.active === 0 && (
                        <span className="rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[10px] font-semibold text-[#22C55E]">
                          Disponible
                        </span>
                      )}
                    </div>

                    <LoadBar active={m.active} max={maxActive} />

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
                      <span>
                        <strong className="text-[#F8FAFC]">{m.active}</strong> actives
                      </span>
                      {m.in_progress > 0 && (
                        <span>
                          <strong className="text-[#22D3EE]">{m.in_progress}</strong> en cours
                        </span>
                      )}
                      {m.review > 0 && (
                        <span>
                          <strong className="text-[#F59E0B]">{m.review}</strong> à valider
                        </span>
                      )}
                      {m.overdue > 0 && (
                        <span>
                          <strong className="text-[#F43F5E]">{m.overdue}</strong> en retard
                        </span>
                      )}
                      <span>
                        <strong className="text-[#22C55E]">{m.done_month}</strong> terminées ce mois
                      </span>
                      {m.total_tracked_seconds > 0 && (
                        <span>{fmtTime(m.total_tracked_seconds)} trackées ce mois</span>
                      )}
                    </div>

                    {m.projects.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.projects.slice(0, 5).map((p) => (
                          <span
                            key={p}
                            className="rounded-md bg-[#22D3EE]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#22D3EE]"
                          >
                            {p}
                          </span>
                        ))}
                        {m.projects.length > 5 && (
                          <span className="text-[10px] text-[#64748B]">
                            +{m.projects.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <svg
                      className={cn(
                        "h-4 w-4 text-[#64748B] transition-transform",
                        isExpanded && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>

                {/* Expanded: overdue tasks detail */}
                {isExpanded && (
                  <div className="border-t border-[#1E2A3A] bg-[#0D1117] px-4 pb-4 pt-3">
                    {m.active === 0 ? (
                      <p className="text-sm text-[#64748B]">
                        Aucune tâche active — membre disponible pour nouvelles missions.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {isOverloaded && (
                          <div className="rounded-lg border border-[#F43F5E]/20 bg-[#F43F5E]/10 px-3 py-2 text-xs text-[#F43F5E]">
                            ⚠ Ce membre a {m.active} tâches actives (seuil :{" "}
                            {OVERLOAD_THRESHOLD}). Envisagez de redistribuer certaines tâches.
                          </div>
                        )}

                        {m.overdue_tasks.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#F43F5E]">
                              Tâches en retard
                            </p>
                            <div className="space-y-1">
                              {m.overdue_tasks.map((t) => (
                                <div
                                  key={t.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-[#F43F5E]/15 bg-[#F43F5E]/8 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <Link
                                      href={`/dashboard/tasks/${t.id}`}
                                      className="text-sm font-medium text-[#F8FAFC] hover:text-[#22D3EE]"
                                    >
                                      {t.title}
                                    </Link>
                                    <p className="text-[11px] text-[#64748B]">
                                      {t.project}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <Badge tone="red">+{t.days_late}j</Badge>
                                    <Link
                                      href={`/dashboard/tasks/${t.id}`}
                                      className="rounded-md bg-[#22D3EE]/10 px-2 py-1 text-xs font-medium text-[#22D3EE] hover:bg-[#22D3EE]/20"
                                    >
                                      Voir →
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {m.overdue_tasks.length === 0 && m.active > 0 && (
                          <p className="text-xs text-[#64748B]">
                            Aucun retard — {m.active} tâches en cours.
                          </p>
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

      {/* Overdue late review section */}
      {summary.withOverdue.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#263244] bg-[#111827]">
          <div className="border-b border-[#263244] bg-[#18212F] px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#F43F5E]">
              Revue retards du jour
            </p>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-[#263244] text-left">
                    <Th>Tâche</Th>
                    <Th>Responsable</Th>
                    <Th>Projet</Th>
                    <Th>Retard</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {summary.withOverdue
                    .flatMap((m) =>
                      m.overdue_tasks.map((t) => ({ ...t, member: m })),
                    )
                    .sort((a, b) => b.days_late - a.days_late)
                    .map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[#1E2A3A] last:border-0 hover:bg-[#1E2A3A]"
                      >
                        <Td>
                          <Link
                            href={`/dashboard/tasks/${row.id}`}
                            className="font-medium text-[#F8FAFC] hover:text-[#22D3EE]"
                          >
                            {row.title}
                          </Link>
                        </Td>
                        <Td>
                          <span className="text-[#94A3B8]">
                            {row.member.full_name ?? `@${row.member.username}`}
                          </span>
                        </Td>
                        <Td>
                          <span className="text-[#64748B]">{row.project}</span>
                        </Td>
                        <Td>
                          <Badge tone="red">+{row.days_late}j</Badge>
                        </Td>
                        <Td>
                          <Link
                            href={`/dashboard/tasks/${row.id}`}
                            className="rounded-md bg-[#22D3EE]/10 px-2 py-1 text-xs font-medium text-[#22D3EE] hover:bg-[#22D3EE]/20"
                          >
                            Ouvrir →
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

function SummaryTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "red" | "amber" | "green" | "neutral" | "slate";
}) {
  const styles = {
    red:     { card: "border-[#F43F5E]/20 bg-[#F43F5E]/8",  val: "text-[#F43F5E]" },
    amber:   { card: "border-[#F59E0B]/20 bg-[#F59E0B]/8",  val: "text-[#F59E0B]" },
    green:   { card: "border-[#22C55E]/20 bg-[#22C55E]/8",  val: "text-[#22C55E]" },
    slate:   { card: "border-[#263244] bg-[#18212F]",        val: "text-[#94A3B8]" },
    neutral: { card: "border-[#263244] bg-[#111827]",        val: "text-[#F8FAFC]" },
  }[tone];

  return (
    <div className={cn("rounded-xl border p-3.5", styles.card)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
        {label}
      </p>
      <p className={cn("mt-1.5 text-lg font-bold", styles.val)}>{value}</p>
      <p className="text-[11px] text-[#64748B]">{sub}</p>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94A3B8]">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 align-middle text-sm">{children}</td>;
}
