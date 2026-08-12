"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/charts/count-up";
import { TrendPill } from "@/components/charts/trend-pill";
import { useI18n } from "@/lib/i18n/provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KpiTone = "cyan" | "green" | "amber" | "red" | "violet" | "neutral";
export type KpiSize = "sm" | "md" | "lg";

export interface KpiCardProps {
  /** Short label shown above the value */
  label: string;
  /** The metric value. Pass a number for animated count-up; pass a string to render as-is. */
  value: number | string;
  /** Unit appended after the value, e.g. " DT" or "%" */
  suffix?: string;
  /** Decimal places for numeric values.
   *  Defaults to 2 when suffix contains "DT" (money), otherwise 0. */
  decimals?: number;
  /** Percentage change; positive = up, negative = down. null hides the pill. */
  trend?: number | null;
  /** When true, renders a "Nouveau" badge instead of a percentage (prev was 0, current > 0). */
  trendIsNew?: boolean;
  /** When true, renders "Aucune donnée" badge (both current and previous are 0). */
  trendNoData?: boolean;
  /** Caption next to the trend pill, e.g. "vs mois dernier" */
  trendLabel?: string;
  /** Colour theme (default: neutral) */
  tone?: KpiTone;
  /** Size variant (default: md) */
  size?: KpiSize;
  /** Optional icon rendered in the top-right corner */
  icon?: ReactNode;
  /** Small helper text displayed below the value */
  tooltip?: string;
  /** Show pulse skeleton while data is loading */
  loading?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Token maps
// ---------------------------------------------------------------------------

const accentBar: Record<KpiTone, string> = {
  cyan:    "bg-accent2",
  green:   "bg-success",
  amber:   "bg-warning",
  red:     "bg-danger",
  violet:  "bg-chart-4",
  neutral: "bg-surface-3",
};

const valueColor: Record<KpiTone, string> = {
  cyan:    "text-accent2",
  green:   "text-success",
  amber:   "text-warning",
  red:     "text-danger",
  violet:  "text-chart-4",
  neutral: "text-content",
};

const iconColor: Record<KpiTone, string> = {
  cyan:    "text-accent2/70",
  green:   "text-success/70",
  amber:   "text-warning/70",
  red:     "text-danger/70",
  violet:  "text-chart-4/70",
  neutral: "text-content-3",
};

const sizePadding: Record<KpiSize, string> = {
  sm: "px-4 py-3",
  md: "px-5 py-4",
  lg: "px-6 py-5",
};

const sizeValue: Record<KpiSize, string> = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

const sizeLabel: Record<KpiSize, string> = {
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-[11px]",
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function KpiSkeleton({ size = "md", className }: { size?: KpiSize; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "overflow-hidden rounded-xl border border-line bg-surface",
        "transition-colors duration-2 ease-ac",
        className,
      )}
    >
      {/* accent bar */}
      <div className="h-1 w-full animate-pulse bg-surface-3" />
      <div className={cn("flex flex-col gap-3", sizePadding[size])}>
        {/* label */}
        <div className="h-2.5 w-20 animate-pulse rounded bg-surface-2" />
        {/* value */}
        <div className="h-8 w-32 animate-pulse rounded bg-surface-2" />
        {/* trend */}
        <div className="h-4 w-24 animate-pulse rounded-full bg-surface-2" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KpiCard({
  label,
  value,
  suffix = "",
  decimals,
  trend = null,
  trendIsNew = false,
  trendNoData = false,
  trendLabel,
  tone = "neutral",
  size = "md",
  icon,
  tooltip,
  loading = false,
  className,
}: KpiCardProps) {
  const { locale } = useI18n();
  const labelNoData = locale === "en" ? "No data" : "Aucune donnée";
  const labelNew = locale === "en" ? "New" : "Nouveau";

  if (loading) {
    return <KpiSkeleton size={size} className={className} />;
  }

  // Auto-default decimals: money (suffix contains "DT") → 2, everything else → 0.
  const isMoney = suffix.trim().toUpperCase().includes("DT");
  const effectiveDecimals = decimals !== undefined ? decimals : isMoney ? 2 : 0;

  const isNumeric = typeof value === "number";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-line bg-surface",
        "transition-colors duration-2 ease-ac",
        "flex flex-col",
        className,
      )}
    >
      {/* Top accent bar */}
      <div className={cn("h-1 w-full flex-shrink-0", accentBar[tone])} />

      {/* Card body */}
      <div className={cn("flex flex-col gap-2 flex-1", sizePadding[size])}>
        {/* Label row */}
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "font-semibold uppercase tracking-widest text-content-3 leading-tight",
              sizeLabel[size],
            )}
          >
            {label}
          </span>

          {icon && (
            <span className={cn("flex-shrink-0 mt-0.5", iconColor[tone])}>
              {icon}
            </span>
          )}
        </div>

        {/* Value */}
        <div className={cn("font-mono font-bold leading-none", sizeValue[size], valueColor[tone])}>
          {isNumeric ? (
            <CountUp
              to={value as number}
              decimals={effectiveDecimals}
              suffix={suffix}
              duration={900}
            />
          ) : (
            <span>
              {value}
              {suffix}
            </span>
          )}
        </div>

        {/* Tooltip / helper text */}
        {tooltip && (
          <p className="text-xs text-content-3 leading-snug">{tooltip}</p>
        )}

        {/* Trend row */}
        {(trendNoData || trendIsNew || (trend !== null && trend !== undefined)) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <TrendPill
              pct={trendIsNew ? null : trend}
              isNew={trendIsNew}
              noData={trendNoData}
              labelNoData={labelNoData}
              labelNew={labelNew}
            />
            {trendLabel && (
              <span className="text-[11px] text-content-3 leading-none">
                {trendLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default KpiCard;
