import AxeBuilder from "@axe-core/playwright";
import { test, expect, login } from "./fixtures";

/**
 * WCAG checks via axe-core.
 *
 * Replaces the hand-rolled contrast walker, which produced false positives in
 * three separate implementations (15 elements reported at exactly 1.00:1, all
 * wrong) because it could not resolve layered translucent surfaces or gradient
 * text. axe resolves stacking, opacity and background images correctly.
 *
 * Rules: wcag2a, wcag2aa, wcag21a, wcag21aa.
 *
 * NO broad exclusions. Any narrow exclusion must carry evidence and a reason
 * inline. There are currently none — findings are reported rather than hidden.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

type Violation = {
  id: string;
  impact?: string | null;
  help: string;
  nodes: { target: unknown[] }[];
};

function summarise(violations: Violation[]): string {
  return violations
    .map(
      (v) =>
        `  [${v.impact ?? "n/a"}] ${v.id} — ${v.help} (${v.nodes.length} node${
          v.nodes.length === 1 ? "" : "s"
        })\n    e.g. ${JSON.stringify(v.nodes[0]?.target)}`,
    )
    .join("\n");
}

/** Serious and critical are treated as failures; minor/moderate are reported. */
const BLOCKING = new Set(["serious", "critical"]);

/**
 * Every scan runs in BOTH themes.
 *
 * Scanning only the default theme was a real hole, not a theoretical one. The
 * contrast failure that took ten routes down was `#5a6b7f on #d8e6f7` — a pair
 * that only exists on the light surfaces — and it went unnoticed because the
 * legacy `--c-*` variables were keyed on a `.dark` selector the redesign
 * removed, so their LIGHT values were resolving underneath the dark theme. A
 * single-theme scan cannot distinguish that from a correct page.
 */
const THEMES = ["dark", "light"] as const;

/** Applies a theme the same way the application's own toggle does. */
async function setTheme(
  page: import("@playwright/test").Page,
  theme: (typeof THEMES)[number],
) {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("light", t === "light");
    try {
      localStorage.setItem("areencubs.theme", t);
    } catch {
      /* storage may be unavailable; the class is what paints */
    }
  }, theme);
  // Surface colour transitions are 150ms; axe reads computed styles, so it must
  // not sample mid-transition.
  await page.waitForTimeout(250);
}

async function scan(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const violations = results.violations as unknown as Violation[];

  if (violations.length > 0) {
    console.log(`\n[axe] ${label} — ${violations.length} violation type(s):`);
    console.log(summarise(violations));

    // Colour pairs are the actionable evidence for the contrast phase: node
    // counts alone cannot tell you which token to change. axe reports the
    // resolved foreground, background and ratio per node.
    for (const v of violations) {
      if (v.id !== "color-contrast") continue;
      const pairs = new Map<string, number>();
      for (const node of v.nodes as unknown as {
        any?: { data?: { fgColor?: string; bgColor?: string; contrastRatio?: number; fontSize?: string } }[];
      }[]) {
        const d = node.any?.[0]?.data;
        if (!d?.fgColor) continue;
        const key = `${d.fgColor} on ${d.bgColor} = ${d.contrastRatio}:1 (${d.fontSize ?? "?"})`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
      const sorted = [...pairs.entries()].sort((a, b) => b[1] - a[1]);
      for (const [pair, count] of sorted) console.log(`    x${count}  ${pair}`);
    }
  }

  const blocking = violations.filter((v) => BLOCKING.has(v.impact ?? ""));
  return { violations, blocking };
}

/**
 * Scans the CURRENT page in both themes and returns one flat list of blocking
 * findings, each tagged with the theme it appeared in so a failure message says
 * which surface to look at.
 */
async function scanThemes(
  page: import("@playwright/test").Page,
  label: string,
): Promise<string[]> {
  const found: string[] = [];
  for (const theme of THEMES) {
    await setTheme(page, theme);
    const { blocking } = await scan(page, `${label} [${theme}]`);
    found.push(...blocking.map((v) => `${theme}: ${v.id} (${v.nodes.length})`));
  }
  return found;
}

test.describe("axe — unauthenticated routes", () => {
  test("login page has no serious or critical violations", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    expect(await scanThemes(page, "/login")).toEqual([]);
  });

  test("the 404 page", async ({ page }) => {
    await page.goto("/no-such-route-exists", { waitUntil: "networkidle" });
    expect(await scanThemes(page, "/404")).toEqual([]);
  });

  test("login page in an error state", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill('input[name="username"]', "nobody-at-all");
    await page.fill('input[name="password"]', "wrong-password");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    expect(await scanThemes(page, "/login (error state)")).toEqual([]);
  });
});

test.describe("axe — authenticated routes", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  for (const route of [
    "/dashboard",
    "/dashboard/tasks",
    "/dashboard/studio-tasks",
    "/dashboard/messages",
    "/dashboard/clients",
    "/dashboard/projects",
    "/dashboard/finance",
    "/dashboard/payroll",
    "/dashboard/content",
    "/dashboard/review",
    "/dashboard/reports",
    "/dashboard/audit",
    "/dashboard/settings",
  ]) {
    test(`${route} has no serious or critical violations`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      expect(await scanThemes(page, route)).toEqual([]);
    });
  }

  test("the account-unavailable denial page", async ({ page, context }) => {
    await context.clearCookies();
    await login(page, "orphan");
    expect(await scanThemes(page, "/account-unavailable")).toEqual([]);
  });
});

test.describe("axe — client portal", () => {
  // Scanned under its own session because the portal is the one surface an
  // admin cannot reach: requireClientContact admits the client role only.
  test("the portal has no serious or critical violations", async ({ page }) => {
    await login(page, "client");
    await page.goto("/portal", { waitUntil: "networkidle" });
    expect(await scanThemes(page, "/portal")).toEqual([]);
  });
});
