"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/avatar";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/utils";

type Member = {
  id: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  job_title: string | null;
  email: string;
  created_at: string;
};

const roleTone: Record<UserRole, "blue" | "green" | "violet"> = {
  admin: "violet",
  worker: "blue",
  freelancer: "green",
};

type RoleFilter = "all" | UserRole;

export function TeamListClient({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (q.length === 0) return true;
      const hay =
        `${m.full_name ?? ""} ${m.username} ${m.email} ${m.job_title ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members, search, roleFilter]);

  const counts = useMemo(() => {
    const base: Record<RoleFilter, number> = {
      all: members.length,
      admin: 0,
      worker: 0,
      freelancer: 0,
    };
    for (const m of members) base[m.role]++;
    return base;
  }, [members]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.team.title}
        description={t.teamUi.description}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/team/planning">
              <Button variant="outline">{t.teamUi.planning}</Button>
            </Link>
            <Link href="/dashboard/team/featured">
              <Button variant="accent">{t.teamUi.featured}</Button>
            </Link>
            <Link href="/dashboard/team/new">
              <Button>{t.team.add}</Button>
            </Link>
          </div>
        }
      />

      {members.length === 0 ? (
        <EmptyState>{t.team.empty}</EmptyState>
      ) : (
        <>
          <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 md:px-5">
            <div className="relative min-w-[220px] flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.filters.searchMember}
                className="w-full rounded-lg border border-ink/10 bg-white/70 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="inline-flex items-center rounded-lg border border-ink/10 bg-white/60 p-0.5">
              {(["all", "admin", "worker", "freelancer"] as RoleFilter[]).map(
                (r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleFilter(r)}
                    aria-pressed={roleFilter === r}
                    className={cn(
                      "h-7 rounded-md px-3 text-xs font-medium transition-all",
                      roleFilter === r
                        ? "bg-brand text-white shadow-sm"
                        : "text-ink/60 hover:bg-white/80 hover:text-ink",
                    )}
                  >
                    {r === "all" ? t.common.all : t.roles[r as UserRole]}
                    <span className="ml-1.5 text-[10px] opacity-75">
                      {counts[r]}
                    </span>
                  </button>
                ),
              )}
            </div>
            <span className="ml-auto rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/65">
              {t.teamUi.members(filtered.length)}
            </span>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>{t.team.columns.name}</TH>
                <TH>{t.team.columns.username}</TH>
                <TH>{t.team.columns.email}</TH>
                <TH>{t.team.columns.role}</TH>
                <TH className="text-right">{t.team.columns.actions}</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={m.avatar_url}
                        name={m.full_name ?? m.username}
                      />
                      <div>
                        <p className="font-medium text-ink">
                          {m.full_name ?? m.username}
                        </p>
                        {m.job_title && (
                          <p className="text-xs text-ink/55">{m.job_title}</p>
                        )}
                        {m.id === currentUserId && (
                          <p className="text-xs text-ink/40">
                            {t.dashboard.welcome}
                          </p>
                        )}
                      </div>
                    </div>
                  </TD>
                  <TD className="text-ink/60">@{m.username}</TD>
                  <TD className="text-ink/60">{m.email}</TD>
                  <TD>
                    <Badge tone={roleTone[m.role]}>{t.roles[m.role]}</Badge>
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/dashboard/team/${m.id}`}
                      className="text-sm font-medium text-brand hover:text-brand-dark"
                    >
                      {t.common.edit}
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}
    </div>
  );
}
