"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";
import type { UserRole } from "@/lib/utils";

type Member = {
  id: string;
  username: string;
  full_name: string | null;
  role: UserRole;
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
          <Link href="/dashboard/team/new">
            <Button>{t.team.add}</Button>
          </Link>
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
                <TD className="font-medium text-slate-900">
                  {m.full_name ?? m.username}
                  {m.id === currentUserId && (
                    <span className="ml-2 text-xs text-slate-400">
                      ({t.dashboard.welcome})
                    </span>
                  )}
                </TD>
                <TD className="text-slate-600">@{m.username}</TD>
                <TD className="text-slate-600">{m.email}</TD>
                <TD>
                  <Badge tone={roleTone[m.role]}>{t.roles[m.role]}</Badge>
                </TD>
                <TD className="text-right">
                  <Link
                    href={`/dashboard/team/${m.id}`}
                    className="text-sm font-medium text-brand hover:underline"
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
