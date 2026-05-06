"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { PageHeader } from "@/components/dashboard/page-header";

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  projects_count: number;
};

export function ClientsListClient({ clients }: { clients: ClientRow[] }) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.clients.title}
        action={
          <Link href="/dashboard/clients/new">
            <Button>{t.clients.add}</Button>
          </Link>
        }
      />

      {clients.length === 0 ? (
        <EmptyState>{t.clients.empty}</EmptyState>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t.clients.columns.name}</TH>
              <TH>{t.clients.columns.email}</TH>
              <TH>{t.clients.columns.phone}</TH>
              <TH>{t.clients.columns.projects}</TH>
              <TH>{t.clients.columns.createdAt}</TH>
            </TR>
          </THead>
          <TBody>
            {clients.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-slate-900">
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="hover:text-brand"
                  >
                    {c.name}
                  </Link>
                </TD>
                <TD className="text-slate-600">{c.email ?? "—"}</TD>
                <TD className="text-slate-600">{c.phone ?? "—"}</TD>
                <TD className="text-slate-600">{c.projects_count}</TD>
                <TD className="text-slate-500">
                  {new Date(c.created_at).toLocaleDateString()}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
