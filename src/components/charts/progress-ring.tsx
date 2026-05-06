"use client";

import { cn } from "@/lib/utils";

type Props = {
  /** 0..100 */
  value: number;
  size?: number;
  thickness?: number;
  /** Track color (default ink/8%) */
  trackColor?: string;
  /** Stroke color (default brand) */
  color?: string;
  /** Optional middle label (e.g. "65%") */
  label?: React.ReactNode;
  className?: string;
};

export function ProgressRing({
  value,
  size = 84,
  thickness = 8,
  trackColor = "rgba(30,30,36,0.08)",
  color = "#3B8BBA",
  label,
  className,
}: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.2,0.65,0.25,1)" }}
        />
      </svg>
      {label !== undefined && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
          {label}
        </div>
      )}
    </div>
  );
}
