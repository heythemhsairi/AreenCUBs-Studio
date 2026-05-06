import { cn } from "@/lib/utils";

type Props = {
  /** Percentage delta. Positive means up, negative means down. */
  pct: number | null;
  className?: string;
  /** Reverse the green/red mapping (e.g. for "outstanding" where lower is better). */
  invert?: boolean;
};

export function TrendPill({ pct, className, invert }: Props) {
  if (pct === null || !Number.isFinite(pct)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink/40",
          className,
        )}
      >
        —
      </span>
    );
  }

  const up = pct > 0;
  const isGood = invert ? !up : up;
  const tone = isGood
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
    : "bg-red-50 text-red-700 ring-1 ring-red-200/60";

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
