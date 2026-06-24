import * as React from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a monetary amount using the French convention:
 * - Space as thousands separator
 * - Comma as decimal separator
 * - `decimals` decimal places (default 3 for Tunisian Dinar)
 *
 * @example formatMoney(12345.678) → "12 345,678"
 */
export function formatMoney(amount: number, decimals = 3): string {
  const fixed = Math.abs(amount).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");

  // Insert non-breaking spaces every 3 digits from the right
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return decimals > 0 ? `${intFormatted},${decPart}` : intFormatted;
}

/**
 * Convenience wrapper that always formats with 3 decimal places (DT convention).
 *
 * @example formatDtAmount(12345.678) → "12 345,678"
 */
export function formatDtAmount(amount: number): string {
  return formatMoney(amount, 3);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Size = "xs" | "sm" | "md" | "lg" | "xl";
type Tone = "positive" | "negative" | "neutral" | "muted";

export interface MoneyAmountProps {
  amount: number;
  /** Currency label shown as a suffix. @default "DT" */
  currency?: string;
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
  /** Optional extra className forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const sizeClasses: Record<Size, { number: string; currency: string }> = {
  xs: { number: "text-xs",   currency: "text-[10px]" },
  sm: { number: "text-sm",   currency: "text-xs"     },
  md: { number: "text-base", currency: "text-sm"     },
  lg: { number: "text-xl",   currency: "text-base"   },
  xl: { number: "text-2xl",  currency: "text-lg"     },
};

const toneClasses: Record<Tone, string> = {
  positive: "text-[#22C55E]",
  negative: "text-[#F43F5E]",
  neutral:  "text-[#F8FAFC]",
  muted:    "text-[#64748B]",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MoneyAmount({
  amount,
  currency = "DT",
  size = "md",
  tone = "neutral",
  showSign = false,
  mono = true,
  bold = true,
  className,
}: MoneyAmountProps) {
  const isNegative = amount < 0;
  const sign = showSign && amount > 0 ? "+" : isNegative ? "-" : "";

  const formatted = formatMoney(Math.abs(amount));

  const { number: numberSizeClass, currency: currencySizeClass } =
    sizeClasses[size];

  const toneClass = toneClasses[tone];

  const fontClass = mono ? "font-mono" : "font-sans";
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
        {formatted}
      </span>

      {currency && (
        <span
          className={[
            currencySizeClass,
            "font-normal text-[#94A3B8]",
          ].join(" ")}
        >
          {currency}
        </span>
      )}
    </span>
  );
}
