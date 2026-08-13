"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

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
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  if (rows.length === 0 || dismissed) return null;

  return (
    <div className="rounded-2xl border border-warning/35 bg-warning-weak p-4 shadow-ac-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-warning/25 bg-warning/10 text-lg">
          ⏰
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-content">
              {rows.length === 1
                ? t.devisUi.staleBannerOne
                : t.devisUi.staleBannerMany(rows.length)}
            </p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={t.devisUi.hide}
              className="text-xs text-content-3 hover:text-content-2"
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
                  className="truncate font-medium text-content-2 hover:text-accent2"
                >
                  {num(d.devis_number)} · {d.client_name}
                </Link>
                <span className="shrink-0 text-content-3">
                  {formatDt(d.total_dt)}
                  <span className="ml-2 rounded-md bg-warning/15 px-1.5 py-0.5 font-semibold text-warning">
                    {t.devisUi.daysSuffix(d.days_since_sent)}
                  </span>
                </span>
              </li>
            ))}
            {rows.length > 4 && (
              <li className="text-[11px] text-content-3">
                <Link
                  href="/dashboard/devis"
                  className="hover:underline"
                >
                  {t.devisUi.moreLink(rows.length - 4)}
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
