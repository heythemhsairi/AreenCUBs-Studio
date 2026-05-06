"use client";

import { useState } from "react";
import { formatDt } from "@/lib/format";

type Point = { label: string; paid: number; invoiced: number };

export function MonthlyRevenueBars({ series }: { series: Point[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const max = Math.max(
    1,
    ...series.map((p) => Math.max(p.paid, p.invoiced)),
  );

  return (
    <div className="space-y-3">
      <div
        className="grid h-48 items-end gap-1.5"
        style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
      >
        {series.map((p, i) => {
          const ph = (p.paid / max) * 100;
          const ih = (p.invoiced / max) * 100;
          return (
            <div
              key={i}
              className="flex h-full items-end gap-0.5"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <div
                className="flex-1 rounded-t bg-brand/30 transition-colors data-[hover=true]:bg-brand"
                data-hover={hoverIdx === i}
                style={{ height: `${Math.max(ih, p.invoiced > 0 ? 1 : 0)}%` }}
                title={`Facturé: ${formatDt(p.invoiced)}`}
              />
              <div
                className="flex-1 rounded-t bg-green-300 transition-colors data-[hover=true]:bg-green-600"
                data-hover={hoverIdx === i}
                style={{ height: `${Math.max(ph, p.paid > 0 ? 1 : 0)}%` }}
                title={`Encaissé: ${formatDt(p.paid)}`}
              />
            </div>
          );
        })}
      </div>
      <div
        className="grid gap-1.5 text-xs text-slate-500"
        style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
      >
        {series.map((p, i) => (
          <span key={i} className="text-center">
            {p.label}
          </span>
        ))}
      </div>
      {hoverIdx !== null && (
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <strong>{series[hoverIdx].label}</strong> · Facturé{" "}
          {formatDt(series[hoverIdx].invoiced)} · Encaissé{" "}
          {formatDt(series[hoverIdx].paid)}
        </div>
      )}
    </div>
  );
}
