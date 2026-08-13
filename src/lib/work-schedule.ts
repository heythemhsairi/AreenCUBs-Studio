export const WORK_LOCATIONS = ["office", "home", "absence", "vacation"] as const;

export type WorkLocation = (typeof WORK_LOCATIONS)[number];

export function isWorkLocation(value: unknown): value is WorkLocation {
  return typeof value === "string" && WORK_LOCATIONS.includes(value as WorkLocation);
}
