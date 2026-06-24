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
                placeholder={t.filters.searchClient}
                className="w-full rounded-lg border border-[#22506F] bg-[#123A5A] py-2 pl-9 pr-3 text-sm text-[#F8FAFC] placeholder:text-[#64748B] transition-colors focus:border-[#22D3EE] focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/20"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 rounded-lg border border-[#22506F] bg-[#123A5A] px-3 text-xs font-medium text-[#94A3B8] focus:border-[#22D3EE] focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/20"
            >
              <option value="newest">{t.common.newest}</option>
              <option value="name">{t.common.nameAZ}</option>
              <option value="projects">{t.common.mostProjects}</option>
            </select>
            <span className="ml-auto rounded-md bg-[#22506F] px-2 py-1 text-xs font-medium text-[#94A3B8]">
              {t.clientsUi.clients(filtered.length)}
            </span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
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
                    <TD className="font-medium">
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="text-[#F8FAFC] hover:text-[#22D3EE] transition-colors"
                      >
                        {c.name}
                      </Link>
                    </TD>
                    <TD className="text-[#94A3B8]">{c.email ?? "—"}</TD>
                    <TD className="text-[#94A3B8]">{c.phone ?? "—"}</TD>
                    <TD className="text-[#94A3B8]">{c.projects_count}</TD>
                    <TD className="text-[#64748B]">
                      {new Date(c.created_at).toLocaleDateString("fr-FR")}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 ? (
              <EmptyState>{t.clients.empty}</EmptyState>
            ) : (
              filtered.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/clients/${c.id}`}
                  className="block rounded-xl border border-[#22506F] bg-[#0D2D47] p-4 hover:border-[#22D3EE]/30 hover:bg-[#1A3E5C] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F8FAFC] truncate">{c.name}</p>
                      {c.email && (
                        <p className="text-xs text-[#94A3B8] truncate mt-0.5">{c.email}</p>
                      )}
                    </div>
                    {c.projects_count > 0 && (
                      <span className="shrink-0 rounded-full bg-[#22D3EE]/10 px-2 py-0.5 text-[11px] font-semibold text-[#22D3EE]">
                        {c.projects_count} projet{c.projects_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#1A3E5C] pt-3">
                    {c.phone ? (
                      <p className="text-xs text-[#64748B]">{c.phone}</p>
                    ) : (
                      <span />
                    )}
                    <p className="text-xs text-[#64748B]">
                      {new Date(c.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
