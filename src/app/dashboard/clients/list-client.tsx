"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

type Sort = "name" | "newest" | "projects";

export function ClientsListClient({ clients }: { clients: ClientRow[] }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = clients;
    if (q.length > 0) {
      rows = rows.filter((c) =>
        `${c.name} ${c.email ?? ""} ${c.phone ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "projects") return b.projects_count - a.projects_count;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    return rows;
  }, [clients, search, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.clients.title}
        description={t.clientsUi.description}
        action={
          <Link href="/dashboard/clients/new">
            <Button>{t.clients.add}</Button>
          </Link>
        }
      />

      {clients.length === 0 ? (
        <EmptyState>{t.clients.empty}</EmptyState>
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
                placeholder={t.filters.searchClient}
                className="w-full rounded-lg border border-ink/10 bg-white/70 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 rounded-lg border border-ink/10 bg-white/70 px-3 text-xs font-medium text-ink/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="newest">{t.common.newest}</option>
              <option value="name">{t.common.nameAZ}</option>
              <option value="projects">{t.common.mostProjects}</option>
            </select>
            <span className="ml-auto rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/65">
              {t.clientsUi.clients(filtered.length)}
            </span>
          </div>
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
              {filtered.map((c) => (
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
        </>
      )}
    </div>
  );
}
