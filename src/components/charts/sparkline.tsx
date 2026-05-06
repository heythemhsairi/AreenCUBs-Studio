"use client";

import { cn } from "@/lib/utils";

type Props = {
  values: number[];
  /** Width in px (default 120) */
  width?: number;
  /** Height in px (default 36) */
  height?: number;
  /** Stroke color, can be hsl/hex/css var (default brand blue) */
  color?: string;
  /** Fill color underneath the line (default same color at 12% opacity) */
  fill?: string;
  className?: string;
};

/**
 * Tiny inline area-chart, ideal for KPI cards. No interactivity, pure SVG,
 * draws a smooth-ish line + filled area below.
 */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = "#3B8BBA",
  fill,
  className,
}: Props) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} className={cn(className)}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeOpacity={0.25}
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`))
    .join(" ");

  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  const fillColor = fill ?? color;
  const gradientId = `spark-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn(className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point highlight */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}
