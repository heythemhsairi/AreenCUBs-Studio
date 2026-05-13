"use client";

import { useMemo, useState } from "react";
import { DevisListTable } from "./devis-list-table";
import { DevisToolbar, type DevisFilters, DEFAULT_DEVIS_FILTERS } from "./devis-toolbar";

type Row = {
  id: string;
  kind?: "devis" | "facture";
  devis_number: number;
  date: string;
  due_date: string;
  object: string | null;
  status: string;
  payment_status: string;
  total_dt: number;
  clients: { id: string; name: string } | { id: string; name: string }[] | null;
};

type ClientOpt = { value: string; label: string };

export function DevisListView({
  rows,
  kind,
  clients,
}: {
  rows: Row[];
  kind: "devis" | "facture";
  clients: ClientOpt[];
}) {
  const [filters, setFilters] = useState<DevisFilters>(DEFAULT_DEVIS_FILTERS);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return rows.filter((r) => {
      const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;

      if (q.length > 0) {
        const hay = `${r.devis_number} ${client?.name ?? ""} ${r.object ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.status !== "all" && r.status !== filters.status) return false;
      if (filters.payment !== "all" && r.payment_status !== filters.payment)
        return false;
      if (filters.clientId !== "all" && client?.id !== filters.clientId)
        return false;

      if (filters.date !== "all") {
        const d = new Date(r.date);
        d.setHours(0, 0, 0, 0);
        if (filters.date === "month") {
          if (
            d.getFullYear() !== now.getFullYear() ||
            d.getMonth() !== now.getMonth()
          )
            return false;
        } else if (filters.date === "quarter") {
          const q1 = Math.floor(now.getMonth() / 3);
          const q2 = Math.floor(d.getMonth() / 3);
          if (d.getFullYear() !== now.getFullYear() || q1 !== q2) return false;
        } else if (filters.date === "year") {
          if (d.getFullYear() !== now.getFullYear()) return false;
        } else if (filters.date === "overdue") {
          const due = new Date(r.due_date);
          due.setHours(0, 0, 0, 0);
          if (due.getTime() >= now.getTime() || r.payment_status === "paid")
            return false;
        }
      }

      return true;
    });
  }, [rows, filters]);

  return (
    <div className="space-y-4">
      <DevisToolbar
        filters={filters}
        onChange={setFilters}
        clients={clients}
        resultCount={filtered.length}
        kind={kind}
      />
      <DevisListTable rows={filtered} kind={kind} />
    </div>
  );
}
