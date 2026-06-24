import { cn } from "@/lib/utils";

type Props = {
  /** Percentage delta. Positive means up, negative means down. */
  pct: number | null;
  className?: string;
  /** Reverse the green/red mapping (e.g. for "outstanding" where lower is better). */
  invert?: boolean;
  /**
   * Pass true when the previous value was 0 and current > 0.
   * Renders a "Nouveau" badge instead of a misleading percentage.
   */
  isNew?: boolean;
  /**
   * Pass true when both current and previous are 0.
   * Renders an "Aucune donnée" badge instead of a percentage.
   */
  noData?: boolean;
};

export function TrendPill({ pct, className, invert, isNew, noData }: Props) {
  // "Aucune donnée" — both values are 0, no comparison meaningful
  if (noData) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-[#263244] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]",
          className,
        )}
      >
        Aucune donnée
      </span>
    );
  }

  // "Nouveau" badge takes priority — previous was 0, current > 0
  if (isNew) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-[#06B6D4]/15 px-2 py-0.5 text-[11px] font-semibold text-[#06B6D4]",
          className,
        )}
      >
        Nouveau
      </span>
    );
  }

  // Null / non-finite → neutral dash
  if (pct === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-[#263244] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]",
          className,
        )}
      >
        —
      </span>
    );
  }

  // Non-finite number → neutral dash
  if (!Number.isFinite(pct)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-[#263244] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]",
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
          "inline-flex items-center gap-0.5 rounded-full bg-[#263244] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]",
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
    ? "bg-[#22C55E]/15 text-[#22C55E]"
    : "bg-[#F43F5E]/15 text-[#F43F5E]";

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
