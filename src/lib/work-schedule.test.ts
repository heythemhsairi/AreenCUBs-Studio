import { describe, expect, it } from "vitest";
import { isWorkLocation, WORK_LOCATIONS } from "./work-schedule";

describe("work schedule statuses", () => {
  it("supports office, home, absence, and vacation", () => {
    expect(WORK_LOCATIONS).toEqual(["office", "home", "absence", "vacation"]);
    for (const status of WORK_LOCATIONS) expect(isWorkLocation(status)).toBe(true);
  });

  it("rejects values outside the persisted enum", () => {
    expect(isWorkLocation("leave")).toBe(false);
    expect(isWorkLocation(null)).toBe(false);
    expect(isWorkLocation({ status: "absence" })).toBe(false);
  });
});
