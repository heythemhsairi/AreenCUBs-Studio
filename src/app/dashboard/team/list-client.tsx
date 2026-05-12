"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/avatar";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";
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

export function TeamListClient({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.team.title}
        action={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/team/featured">
              <Button variant="accent">⭐ Employé du mois</Button>
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
            {members.map((m) => (
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
      )}
    </div>
  );
}
