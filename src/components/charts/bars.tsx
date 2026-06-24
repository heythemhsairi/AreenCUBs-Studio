"use client";

import { useState } from "react";
import { formatDt } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BarPoint = {
  label: string;
  paid: number;
  invoiced: number;
  expenses?: number;
  profit?: number;
};

type Props = {
  series: BarPoint[];
  className?: string;
  height?: number;
};

export function MonthlyBars({ series, className, height = 200 }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const hasExpenses = series.some((p) => (p.expenses ?? 0) > 0);

  const max = Math.max(
    1,
    ...series.map((p) => Math.max(p.paid, p.invoiced, p.expenses ?? 0)),
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="grid items-end gap-1.5"
        style={{
          height,
          gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
        }}
      >
        {series.map((p, i) => {
          const ph = (p.paid / max) * 100;
          const ih = (p.invoiced / max) * 100;
          const eh = ((p.expenses ?? 0) / max) * 100;
          const isHover = hoverIdx === i;
          return (
            <div
              key={i}
              className="flex h-full items-end gap-0.5 cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {/* Invoiced bar */}
              <div
                className={cn(
                  "flex-1 rounded-t bg-gradient-to-t transition-all duration-200",
                  isHover ? "from-brand-dark to-brand" : "from-brand/40 to-brand/20",
                )}
                style={{ height: `${Math.max(ih, p.invoiced > 0 ? 2 : 0)}%` }}
              />
              {/* Paid bar */}
              <div
                className={cn(
                  "flex-1 rounded-t bg-gradient-to-t transition-all duration-200",
                  isHover ? "from-emerald-600 to-emerald-400" : "from-emerald-300/80 to-emerald-200/70",
                )}
                style={{ height: `${Math.max(ph, p.paid > 0 ? 2 : 0)}%` }}
              />
              {/* Expenses bar (optional) */}
              {hasExpenses && (
                <div
                  className={cn(
                    "flex-1 rounded-t bg-gradient-to-t transition-all duration-200",
                    isHover ? "from-red-500 to-red-300" : "from-red-300/60 to-red-200/40",
                  )}
                  style={{ height: `${Math.max(eh, (p.expenses ?? 0) > 0 ? 2 : 0)}%` }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        className="grid gap-1.5 text-[11px] text-ink/50"
        style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
      >
        {series.map((p, i) => (
          <span key={i} className={cn("text-center transition-colors", hoverIdx === i && "font-semibold text-ink")}>
            {p.label}
          </span>
        ))}
      </div>

      {/* Legend + hover tooltip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream/60 px-3 py-2 text-xs text-ink/70 ring-1 ring-ink/5">
        {hoverIdx !== null ? (
          <div className="flex flex-wrap items-center gap-3">
            <strong className="text-ink">{series[hoverIdx].label}</strong>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-brand" /> Facturé{" "}
              <strong className="text-ink">{formatDt(series[hoverIdx].invoiced)}</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Encaissé{" "}
              <strong className="text-ink">{formatDt(series[hoverIdx].paid)}</strong>
            </span>
            {hasExpenses && (
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-red-400" /> Dépenses{" "}
                <strong className="text-ink">{formatDt(series[hoverIdx].expenses ?? 0)}</strong>
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-brand" /> Facturé</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Encaissé</span>
            {hasExpenses && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400" /> Dépenses</span>}
            <span className="text-ink/35">Survolez pour le détail</span>
          </div>
        )}
      </div>
    </div>
  );
}
