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
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#22506F] bg-[#0D2D47] px-4 py-3 md:px-5">
            <div className="relative min-w-[220px] flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
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
                className="w-full rounded-lg border border-[#22506F] bg-[#123A5A] py-2 pl-9 pr-3 text-sm text-[#F8FAFC] placeholder:text-[#64748B] transition-colors focus:border-[#22D3EE] focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/20"
              />
            </div>
            {/* Role filter tabs */}
            <div className="inline-flex items-center rounded-lg border border-[#22506F] bg-[#123A5A] p-0.5">
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
                        ? "bg-[#22D3EE] text-[#071B2C] shadow-sm"
                        : "text-[#94A3B8] hover:bg-[#22506F] hover:text-[#F8FAFC]",
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
            <span className="ml-auto rounded-md bg-[#22506F] px-2 py-1 text-xs font-medium text-[#94A3B8]">
              {t.teamUi.members(filtered.length)}
            </span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
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
                          <p className="font-medium text-[#F8FAFC]">
                            {m.full_name ?? m.username}
                          </p>
                          {m.job_title && (
                            <p className="text-xs text-[#64748B]">{m.job_title}</p>
                          )}
                          {m.id === currentUserId && (
                            <p className="text-xs text-[#22D3EE]/70">
                              {t.dashboard.welcome}
                            </p>
                          )}
                        </div>
                      </div>
                    </TD>
                    <TD className="text-[#94A3B8]">@{m.username}</TD>
                    <TD className="text-[#94A3B8]">{m.email}</TD>
                    <TD>
                      <Badge tone={roleTone[m.role]}>{t.roles[m.role]}</Badge>
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={`/dashboard/team/${m.id}`}
                        className="text-sm font-medium text-[#22D3EE] hover:text-[#06B6D4]"
                      >
                        {t.common.edit}
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 ? (
              <EmptyState>{t.team.empty}</EmptyState>
            ) : (
              filtered.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-[#22506F] bg-[#0D2D47] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={m.avatar_url}
                        name={m.full_name ?? m.username}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-[#F8FAFC] truncate">
                          {m.full_name ?? m.username}
                        </p>
                        {m.job_title && (
                          <p className="text-xs text-[#64748B] truncate">{m.job_title}</p>
                        )}
                        {m.id === currentUserId && (
                          <p className="text-xs text-[#22D3EE]/70">Vous</p>
                        )}
                      </div>
                    </div>
                    <Badge tone={roleTone[m.role]}>{t.roles[m.role]}</Badge>
                  </div>
                  <div className="mt-3 space-y-1 border-t border-[#1A3E5C] pt-3">
                    <p className="text-xs text-[#94A3B8]">
                      <span className="text-[#64748B]">@</span>{m.username}
                    </p>
                    <p className="text-xs text-[#94A3B8] truncate">{m.email}</p>
                  </div>
                  <div className="mt-3">
                    <Link
                      href={`/dashboard/team/${m.id}`}
                      className="inline-flex h-8 items-center rounded-lg border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-3 text-xs font-semibold text-[#22D3EE] hover:bg-[#22D3EE]/20 transition-colors"
                    >
                      {t.common.edit}
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
