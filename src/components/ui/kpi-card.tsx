"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/charts/count-up";
import { TrendPill } from "@/components/charts/trend-pill";

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
  cyan:    "bg-[#22D3EE]",
  green:   "bg-[#22C55E]",
  amber:   "bg-[#F59E0B]",
  red:     "bg-[#F43F5E]",
  violet:  "bg-[#A78BFA]",
  neutral: "bg-[#22506F]",
};

const valueColor: Record<KpiTone, string> = {
  cyan:    "text-[#22D3EE]",
  green:   "text-[#22C55E]",
  amber:   "text-[#F59E0B]",
  red:     "text-[#F43F5E]",
  violet:  "text-[#A78BFA]",
  neutral: "text-[#F8FAFC]",
};

const iconColor: Record<KpiTone, string> = {
  cyan:    "text-[#22D3EE]/70",
  green:   "text-[#22C55E]/70",
  amber:   "text-[#F59E0B]/70",
  red:     "text-[#F43F5E]/70",
  violet:  "text-[#A78BFA]/70",
  neutral: "text-[#64748B]",
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
        "bg-[#0D2D47] border border-[#22506F] rounded-xl overflow-hidden",
        className,
      )}
    >
      {/* accent bar */}
      <div className="h-1 w-full animate-pulse bg-[#22506F]" />
      <div className={cn("flex flex-col gap-3", sizePadding[size])}>
        {/* label */}
        <div className="h-2.5 w-20 animate-pulse rounded bg-[#1A3E5C]" />
        {/* value */}
        <div className="h-8 w-32 animate-pulse rounded bg-[#1A3E5C]" />
        {/* trend */}
        <div className="h-4 w-24 animate-pulse rounded-full bg-[#1A3E5C]" />
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
        "bg-[#0D2D47] border border-[#22506F] rounded-xl overflow-hidden",
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
              "font-semibold uppercase tracking-widest text-[#64748B] leading-tight",
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
          <p className="text-xs text-[#64748B] leading-snug">{tooltip}</p>
        )}

        {/* Trend row */}
        {(trendNoData || trendIsNew || (trend !== null && trend !== undefined)) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <TrendPill
              pct={trendIsNew ? null : trend}
              isNew={trendIsNew}
              noData={trendNoData}
            />
            {trendLabel && (
              <span className="text-[11px] text-[#64748B] leading-none">
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
