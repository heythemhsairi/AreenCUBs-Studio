"use client";

import { useEffect, useState } from "react";

/**
 * Resolves the chart tokens to concrete colour strings at runtime.
 *
 * Charts cannot use the tokens the way the rest of the UI does. Recharts sets
 * `fill` and `stroke` as SVG PRESENTATION ATTRIBUTES, and `var()` does not
 * resolve in an attribute — `fill="rgb(var(--ac-chart-1))"` renders as black,
 * silently. So the values are read from the computed styles of the document
 * element and handed over as plain `rgb(r g b)` strings.
 *
 * Because they are read rather than declared, they must be re-read when the
 * theme changes. A MutationObserver on the root's class list does that: the
 * theme toggle adds and removes `.light` there, so the observer fires exactly
 * when the palette becomes stale and never on unrelated renders.
 *
 * The initial state is the LIGHT ramp rather than an empty array — the first
 * client render happens before the effect runs, and returning nothing would
 * paint every series black for a frame.
 */

export type ChartColors = {
  /** Six categorical series, ordered for colour-blind separability. */
  series: string[];
  grid: string;
  track: string;
  text: string;
  /** Semantic series, for charts where a colour carries meaning. */
  success: string;
  warning: string;
  danger: string;
  info: string;
  accent: string;
};

const TOKENS: Record<keyof Omit<ChartColors, "series">, string> = {
  grid: "--ac-chart-grid",
  track: "--ac-chart-track",
  text: "--ac-text-3",
  success: "--ac-success",
  warning: "--ac-warning",
  danger: "--ac-danger",
  info: "--ac-info",
  accent: "--ac-accent",
};

/** Light-theme values, so the pre-effect frame is never black. */
const FALLBACK: ChartColors = {
  series: [
    "rgb(16 100 212)",
    "rgb(180 105 14)",
    "rgb(14 124 134)",
    "rgb(162 58 135)",
    "rgb(90 107 127)",
    "rgb(47 125 50)",
  ],
  grid: "rgb(211 218 226)",
  track: "rgb(232 235 236)",
  text: "rgb(90 107 127)",
  success: "rgb(22 101 52)",
  warning: "rgb(124 74 2)",
  danger: "rgb(143 26 48)",
  info: "rgb(10 86 128)",
  accent: "rgb(13 84 180)",
};

function read(): ChartColors {
  if (typeof window === "undefined") return FALLBACK;
  const style = getComputedStyle(document.documentElement);
  const value = (name: string, fallback: string) => {
    const raw = style.getPropertyValue(name).trim();
    return raw ? `rgb(${raw})` : fallback;
  };
  return {
    series: [1, 2, 3, 4, 5, 6].map((n, i) =>
      value(`--ac-chart-${n}`, FALLBACK.series[i]),
    ),
    grid: value(TOKENS.grid, FALLBACK.grid),
    track: value(TOKENS.track, FALLBACK.track),
    text: value(TOKENS.text, FALLBACK.text),
    success: value(TOKENS.success, FALLBACK.success),
    warning: value(TOKENS.warning, FALLBACK.warning),
    danger: value(TOKENS.danger, FALLBACK.danger),
    info: value(TOKENS.info, FALLBACK.info),
    accent: value(TOKENS.accent, FALLBACK.accent),
  };
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    setColors(read());

    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
