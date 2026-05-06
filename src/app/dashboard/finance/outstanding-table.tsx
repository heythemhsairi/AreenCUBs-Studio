"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDt, formatDate, formatDevisNumber } from "@/lib/format";

type Row = {
  devis_id: string;
  devis_number: number;
  client_id: string | null;
  client_name: string;
  total_dt: number;
  paid_dt: number;
  outstanding_dt: number;
  due_date: string;
  days_overdue: number;
};

export function OutstandingTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun impayé. Tout est à jour 🎉
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => (
        <li
          key={r.devis_id}
          className="flex items-center justify-between gap-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">
              {r.client_id ? (
                <Link
                  href={`/dashboard/clients/${r.client_id}`}
                  className="hover:text-brand"
                >
                  {r.client_name}
                </Link>
              ) : (
                r.client_name
              )}
            </p>
            <p className="text-xs text-slate-500">
              <Link
                href={`/dashboard/devis/${r.devis_id}`}
                className="hover:text-brand"
              >
                {formatDevisNumber(r.devis_number)}
              </Link>{" "}
              · échéance {formatDate(r.due_date)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-sm font-semibold text-slate-900">
              {formatDt(r.outstanding_dt)}
            </span>
            <OverdueBadge days={r.days_overdue} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function OverdueBadge({ days }: { days: number }) {
  if (days < 0) {
    return <Badge tone="slate">dans {Math.abs(days)}j</Badge>;
  }
  if (days === 0) {
    return <Badge tone="amber">aujourd&apos;hui</Badge>;
  }
  if (days <= 7) {
    return <Badge tone="amber">+{days}j</Badge>;
  }
  return <Badge tone="red">+{days}j de retard</Badge>;
}
