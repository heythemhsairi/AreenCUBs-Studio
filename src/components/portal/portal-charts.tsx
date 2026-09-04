"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { useChartColors } from "@/components/charts/use-chart-colors";

/**
 * A donut broken down by workflow state, not by an arbitrary series index.
 *
 * Colour follows the same four roles the rest of the portal already uses for
 * status (see `taskStatusTone` / `badgeTone`): warning for "not started",
 * info for "in progress", success for "done", and the muted text tone for
 * "cancelled" — there is no dedicated neutral chart token, so this reuses
 * `--ac-text-3` via `useChartColors().text`, which is exactly the tone the
 * "slate" badge already renders in. A legend line (dot + label + % + count)
 * always accompanies the ring, so state is never colour-alone.
 */
export type DonutTone = "warning" | "info" | "success" | "neutral";
export type DonutSlice = { label: string; value: number; tone: DonutTone };

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { fill: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.payload.fill }} aria-hidden="true" />
        <span className="text-content-3">{entry.name} :</span>
        <span className="font-semibold text-content">{entry.value}</span>
      </div>
    </div>
  );
}

export function StatusDonut({
  title,
  subtitle,
  centerLabel,
  emptyLabel,
  data,
}: {
  title: string;
  subtitle?: string;
  centerLabel: string;
  emptyLabel: string;
  data: DonutSlice[];
}) {
  const colors = useChartColors();
  const toneColor: Record<DonutTone, string> = {
    warning: colors.warning,
    info: colors.info,
    success: colors.success,
    neutral: colors.text,
  };
  const resolved = data.map((d) => ({ ...d, fill: toneColor[d.tone] }));
  const total = resolved.reduce((sum, d) => sum + d.value, 0);
  const nonZero = resolved.filter((d) => d.value > 0);

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-content">{title}</p>
      {subtitle && <p className="mt-0.5 truncate text-xs text-content-3">{subtitle}</p>}

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-content-3">{emptyLabel}</p>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <div className="relative h-[130px] w-[130px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={nonZero}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="68%"
                  outerRadius="100%"
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {nonZero.map((d) => (
                    <Cell key={d.label} fill={d.fill} />
                  ))}
                </Pie>
                <RechartsTooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums text-content">{total}</span>
              <span className="text-[10px] text-content-3">{centerLabel}</span>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-1.5">
            {resolved.map((d) => {
              const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
              return (
                <li key={d.label} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.fill }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-content-2">{d.label}</span>
                  <span className="tabular-nums text-content-3">{pct}%</span>
                  <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-content">{d.value}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
