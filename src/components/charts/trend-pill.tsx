import { cn } from "@/lib/utils";

type Props = {
  /** Percentage delta. Positive means up, negative means down. */
  pct: number | null;
  className?: string;
  /** Reverse the green/red mapping (e.g. for "outstanding" where lower is better). */
  invert?: boolean;
  /**
   * Pass true when the previous value was 0 and current > 0.
   * Renders a "New" badge instead of a misleading percentage.
   */
  isNew?: boolean;
  /**
   * Pass true when both current and previous are 0.
   * Renders a "No data" badge instead of a percentage.
   */
  noData?: boolean;
  /** Labels override — pass translated strings */
  labelNoData?: string;
  labelNew?: string;
};

export function TrendPill({ pct, className, invert, isNew, noData, labelNoData = "No data", labelNew = "New" }: Props) {
  // "No data" — both values are 0, no comparison meaningful
  if (noData) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-[var(--c-border)] px-2 py-0.5 text-[11px] font-semibold text-content-3",
          className,
        )}
      >
        {labelNoData}
      </span>
    );
  }

  // "New" badge takes priority — previous was 0, current > 0
  if (isNew) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-accent2/15 px-2 py-0.5 text-[11px] font-semibold text-accent2",
          className,
        )}
      >
        {labelNew}
      </span>
    );
  }

  // Null / non-finite → neutral dash
  if (pct === null || !Number.isFinite(pct)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-[var(--c-border)] px-2 py-0.5 text-[11px] font-semibold text-content-3",
          className,
        )}
      >
        —
      </span>
    );
  }

  // Zero → neutral "=" badge
  if (pct === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-[var(--c-border)] px-2 py-0.5 text-[11px] font-semibold text-content-3",
          className,
        )}
      >
        =
      </span>
    );
  }

  const up = pct > 0;
  const isGood = invert ? !up : up;

  const tone = isGood
    ? "bg-success/15 text-success"
    : "bg-danger/15 text-danger";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone,
        className,
      )}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={up ? "" : "rotate-180"}
      >
        <path d="M12 5v14M5 12l7-7 7 7" />
      </svg>
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}
