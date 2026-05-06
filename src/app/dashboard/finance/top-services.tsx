"use client";

import { formatDt } from "@/lib/format";

type Service = { name: string; total_dt: number; count: number };

export function TopServicesList({ services }: { services: Service[] }) {
  if (services.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun devis envoyé ou accepté pour le moment.
      </p>
    );
  }

  const max = Math.max(...services.map((s) => s.total_dt), 1);

  return (
    <ul className="space-y-2.5">
      {services.map((s) => {
        const pct = (s.total_dt / max) * 100;
        return (
          <li key={s.name} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-slate-800">{s.name}</span>
              <span className="shrink-0 text-slate-600">
                <span className="font-medium text-slate-900">
                  {formatDt(s.total_dt)}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  ×{s.count}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-brand"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
