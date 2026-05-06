"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";

type Status = "active" | "on_hold" | "completed" | "cancelled";

const statusTone: Record<Status, "blue" | "amber" | "green" | "slate"> = {
  active: "blue",
  on_hold: "amber",
  completed: "green",
  cancelled: "slate",
};

export type ProjectRow = {
  id: string;
  name: string;
  status: Status;
  end_date: string | null;
  owner: string;
  tasks_count: number;
  client?: { id: string; name: string };
};

export function ProjectsTable({
  projects,
  showClient,
}: {
  projects: ProjectRow[];
  showClient?: boolean;
}) {
  const { t } = useI18n();

  if (projects.length === 0) {
    return <EmptyState>{t.projects.empty}</EmptyState>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>{t.projects.columns.name}</TH>
          {showClient && <TH>Client</TH>}
          <TH>{t.projects.columns.status}</TH>
          <TH>{t.projects.columns.owner}</TH>
          <TH>{t.projects.columns.deadline}</TH>
          <TH>{t.projects.columns.tasks}</TH>
        </TR>
      </THead>
      <TBody>
        {projects.map((p) => (
          <TR key={p.id}>
            <TD className="font-medium text-slate-900">
              <Link
                href={`/dashboard/projects/${p.id}`}
                className="hover:text-brand"
              >
                {p.name}
              </Link>
            </TD>
            {showClient && (
              <TD className="text-slate-600">
                {p.client ? (
                  <Link
                    href={`/dashboard/clients/${p.client.id}`}
                    className="hover:text-brand"
                  >
                    {p.client.name}
                  </Link>
                ) : (
                  "—"
                )}
              </TD>
            )}
            <TD>
              <Badge tone={statusTone[p.status]}>
                {t.projects.status[p.status]}
              </Badge>
            </TD>
            <TD className="text-slate-600">{p.owner}</TD>
            <TD className="text-slate-600">
              {p.end_date
                ? new Date(p.end_date).toLocaleDateString()
                : "—"}
            </TD>
            <TD className="text-slate-600">{p.tasks_count}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
