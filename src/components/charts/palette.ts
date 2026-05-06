// Plain server-friendly module (no "use client") so server components can
// import the brand palette without crossing a client boundary.

export const DONUT_PALETTE = [
  "#3B8BBA", // brand
  "#FF9E1F", // accent
  "#1E1E24", // ink
  "#7AB9D9", // brand light
  "#FFC07A", // accent light
  "#5A5A66", // ink soft
  "#2C6E96", // brand dark
  "#E08800", // accent dark
];

export function getDonutPalette(): string[] {
  return [...DONUT_PALETTE];
}
