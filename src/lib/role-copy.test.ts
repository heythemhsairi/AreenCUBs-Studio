import { describe, expect, it } from "vitest";
import { collaborationWelcome, taskAssignedMessage, taskDoneMessage, taskOpenMessage } from "./role-copy";

const roles = ["admin", "worker", "freelancer", "commercial", "intern"] as const;

describe("role-aware task copy", () => {
  it("gives every internal role distinct supportive copy", () => {
    const openMessages = roles.map((role) => taskOpenMessage(role));
    const doneMessages = roles.map((role) => taskDoneMessage(role));
    const collaborationMessages = roles.map((role) => collaborationWelcome(role));

    expect(new Set(openMessages).size).toBe(roles.length);
    expect(new Set(doneMessages).size).toBe(roles.length);
    expect(new Set(collaborationMessages).size).toBe(roles.length);
  });

  it("keeps the assigned task title in every role notification", () => {
    for (const role of roles) {
      expect(taskAssignedMessage(role, "Préparer le tournage")).toContain("Préparer le tournage");
    }
  });

  it("supports the English interface", () => {
    expect(taskDoneMessage("intern", "en")).toContain("Well done");
    expect(collaborationWelcome("commercial", "en")).toContain("client context");
  });
});
