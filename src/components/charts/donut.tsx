"use client";

import { useState } from "react";
import { formatDt } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  data: DonutSlice[];
  /** Outer SVG size in px. Defaults to 200. */
  size?: number;
  /** Stroke width of the ring */
  thickness?: number;
  /** Big center metric (auto-computed total if not provided) */
  centerLabel?: string;
  /** Center sub-label */
  centerSub?: string;
  className?: string;
};

// Palette is re-exported for backwards compatibility, but the canonical
// source lives in `./palette.ts` (no "use client" so server components
// can import safely).
export { getDonutPalette } from "./palette";

export function Donut({
  data,
  size = 200,
  thickness = 22,
  centerLabel,
  centerSub,
  className,
}: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <div
          className="rounded-full border-ink/5"
          style={{
            width: size,
            height: size,
            borderWidth: thickness,
            borderColor: "var(--chart-track)",
          }}
        />
      </div>
    );
  }

  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const segments = data.map((d, i) => {
    const fraction = d.value / total;
    const length = fraction * circumference;
    const offset = -cumulative;
    cumulative += length;
    return { ...d, fraction, length, offset, idx: i };
  });

  const hovered = hoverIdx !== null ? segments[hoverIdx] : null;

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--chart-track)"
            strokeWidth={thickness}
          />
          {segments.map((s) => {
            const dim = hoverIdx !== null && hoverIdx !== s.idx;
            return (
              <circle
                key={s.idx}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${s.length} ${circumference - s.length}`}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
                className={cn(
                  "transition-opacity duration-200",
                  dim ? "opacity-25" : "opacity-100",
                )}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverIdx(s.idx)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">
            {hovered ? hovered.label : (centerSub ?? "Total")}
          </p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight text-ink">
            {hovered ? formatDt(hovered.value) : (centerLabel ?? formatDt(total))}
          </p>
          {hovered && (
            <p className="text-[11px] text-ink/55">
              {(hovered.fraction * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DonutLegend({
  data,
  className,
}: {
  data: DonutSlice[];
  className?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ul className={cn("space-y-2", className)}>
      {data.map((d) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        return (
          <li
            key={d.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: d.color }}
              />
              <span className="truncate text-ink/75">{d.label}</span>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-xs font-semibold text-ink">
                {formatDt(d.value)}
              </span>
              <span className="ml-2 text-[11px] text-ink/45">
                {pct.toFixed(0)}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
