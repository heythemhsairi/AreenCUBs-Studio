import * as React from "react";

import { formatDt } from "@/lib/format";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a number with fr-FR locale, 2 decimal places, no currency suffix.
 * e.g. 1190 → "1 190,00"
 */
function formatNumber(value: number): string {
  return Math.abs(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Compact abbreviation for tight spaces.
 * Uses the same 2-decimal, fr-FR style for the abbreviated number.
 *
 * @example
 *   compact(1190)        → "1,19k"
 *   compact(1_500_000)   → "1,50M"
 *   compact(500)         → "500,00"
 */
function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const n = (abs / 1_000_000).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${n}M`;
  }
  if (abs >= 1_000) {
    const n = (abs / 1_000).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${n}k`;
  }
  return formatNumber(abs);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Size = "sm" | "md" | "lg" | "xl";
type Tone = "positive" | "negative" | "neutral" | "muted";

export interface MoneyAmountProps {
  amount: number;
  /** Controls the text size of the numeric part. @default "md" */
  size?: Size;
  /** Controls the colour of the numeric part. @default "neutral" */
  tone?: Tone;
  /** When true, prepends "+" for positive amounts. @default false */
  showSign?: boolean;
  /** When true, renders the number in a monospace font. @default true */
  mono?: boolean;
  /** When true, renders the number in a bold weight. @default true */
  bold?: boolean;
  /**
   * When true, abbreviates large numbers for tight spaces.
   * 1 190,00 DT → 1,19k DT  |  1 500 000,00 DT → 1,50M DT
   * @default false
   */
  compact?: boolean;
  /** Optional extra className forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const sizeClasses: Record<Size, { number: string; currency: string }> = {
  sm: { number: "text-sm",   currency: "text-xs"   },
  md: { number: "text-base", currency: "text-sm"   },
  lg: { number: "text-xl",   currency: "text-base" },
  xl: { number: "text-2xl",  currency: "text-lg"   },
};

/** Dark-first palette — white/light text on dark surfaces. */
const toneClasses: Record<Tone, string> = {
  positive: "text-[#22C55E]",
  negative: "text-[#F43F5E]",
  neutral:  "text-[#F8FAFC]",   // near-white
  muted:    "text-[#94A3B8]",   // slate-400
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MoneyAmount({
  amount,
  size = "md",
  tone = "neutral",
  showSign = false,
  mono = true,
  bold = true,
  compact = false,
  className,
}: MoneyAmountProps) {
  const isNegative = amount < 0;
  const sign = showSign && amount > 0 ? "+" : isNegative ? "-" : "";

  // Formatted numeric string (no currency suffix)
  const formattedNumber = compact
    ? formatCompact(Math.abs(amount))
    : formatNumber(Math.abs(amount));

  const { number: numberSizeClass, currency: currencySizeClass } =
    sizeClasses[size];

  const toneClass  = toneClasses[tone];
  const fontClass  = mono ? "font-mono" : "font-sans";
  const weightClass = bold ? "font-bold" : "font-normal";

  return (
    <span
      className={[
        "inline-flex items-baseline gap-1 tabular-nums leading-none",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <span
        className={[
          numberSizeClass,
          toneClass,
          fontClass,
          weightClass,
          "tracking-tight",
        ].join(" ")}
      >
        {sign}
        {formattedNumber}
      </span>

      <span
        className={[
          currencySizeClass,
          "font-normal text-[#94A3B8]",
        ].join(" ")}
      >
        DT
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Re-export formatDt so callers that previously imported formatMoney /
// formatDtAmount from this file can migrate to the shared utility.
// ---------------------------------------------------------------------------
export { formatDt };
