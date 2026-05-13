"use client";

import Link from "next/link";
import { useState } from "react";

export type StaleDevisRow = {
  id: string;
  kind: "devis" | "facture";
  devis_number: number;
  client_name: string;
  total_dt: number;
  date: string;
  days_since_sent: number;
};

function formatDt(v: number): string {
  return `${Number(v).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DT`;
}

function num(n: number): string {
  return `EST-${String(n).padStart(7, "0")}`;
}

export function StaleDevisBanner({ rows }: { rows: StaleDevisRow[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (rows.length === 0 || dismissed) return null;

  return (
    <div className="rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/15 via-white/85 to-accent/10 p-4 dark:from-accent/25 dark:via-[#1c1f29]/85 dark:to-accent/15 dark:border-accent/30">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/25 text-lg">
          ⏰
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink dark:text-cream">
              {rows.length === 1
                ? "1 devis attend une réponse depuis plus de 7 jours"
                : `${rows.length} devis attendent une réponse depuis plus de 7 jours`}
            </p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Masquer"
              className="text-xs text-ink/40 hover:text-ink/70"
            >
              ×
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {rows.slice(0, 4).map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <Link
                  href={`/dashboard/${d.kind === "facture" ? "factures" : "devis"}/${d.id}`}
                  className="truncate font-medium text-ink/85 hover:text-brand dark:text-cream/90"
                >
                  {num(d.devis_number)} · {d.client_name}
                </Link>
                <span className="shrink-0 text-ink/55 dark:text-cream/55">
                  {formatDt(d.total_dt)}
                  <span className="ml-2 rounded-md bg-accent/20 px-1.5 py-0.5 font-semibold text-accent-dark dark:text-accent">
                    +{d.days_since_sent}j
                  </span>
                </span>
              </li>
            ))}
            {rows.length > 4 && (
              <li className="text-[11px] text-ink/45">
                <Link
                  href="/dashboard/devis"
                  className="hover:underline"
                >
                  +{rows.length - 4} de plus →
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
