import { test, login, ACCOUNTS } from "./fixtures";

/**
 * Expanded design-evidence matrix: every ROLE across its own routes, in BOTH
 * themes, at all three viewports.
 *
 * The old 12-screen set only ever photographed the administrator in the
 * default theme, which is exactly the blind spot a redesign creates — the
 * light theme and the four non-admin roles were being changed without anyone
 * looking at them. Fabricated data throughout; output is gitignored.
 *
 *   npx playwright test shots
 */

type Shot = { name: string; path: string };

/** Routes each role can actually reach. A redirect photographs nothing. */
const BY_ROLE: Record<string, Shot[]> = {
  admin: [
    { name: "dashboard", path: "/dashboard" },
    { name: "tasks", path: "/dashboard/tasks" },
    { name: "clients", path: "/dashboard/clients" },
    { name: "projects", path: "/dashboard/projects" },
    { name: "finance", path: "/dashboard/finance" },
    { name: "devis", path: "/dashboard/devis" },
    { name: "factures", path: "/dashboard/factures" },
    { name: "content", path: "/dashboard/content" },
    { name: "content-publishing", path: "/dashboard/content/publishing" },
    { name: "calendar", path: "/dashboard/calendar" },
    { name: "review", path: "/dashboard/review" },
    { name: "reports", path: "/dashboard/reports" },
    { name: "audit", path: "/dashboard/audit" },
    { name: "team", path: "/dashboard/team" },
    { name: "services", path: "/dashboard/services" },
    { name: "settings", path: "/dashboard/settings" },
    { name: "profile", path: "/dashboard/profile" },
  ],
  commercial: [
    { name: "dashboard", path: "/dashboard" },
    { name: "clients", path: "/dashboard/clients" },
    { name: "devis", path: "/dashboard/devis" },
    { name: "review", path: "/dashboard/review" },
  ],
  intern: [
    { name: "dashboard", path: "/dashboard" },
    { name: "tasks", path: "/dashboard/tasks" },
  ],
  worker: [
    { name: "dashboard", path: "/dashboard" },
    { name: "tasks", path: "/dashboard/tasks" },
    { name: "clients", path: "/dashboard/clients" },
  ],
  freelancer: [
    { name: "dashboard", path: "/dashboard" },
    { name: "tasks", path: "/dashboard/tasks" },
  ],
  client: [{ name: "portal", path: "/portal" }],
};

/** Applies the theme the same way the app does, then settles. */
async function setTheme(page: import("@playwright/test").Page, theme: "dark" | "light") {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("light", t === "light");
    try {
      localStorage.setItem("areencubs.theme", t);
    } catch {
      /* storage may be unavailable; the class is what paints */
    }
  }, theme);
  await page.waitForTimeout(250);
}

for (const [role, shots] of Object.entries(BY_ROLE)) {
  test.describe(`design evidence — ${role}`, () => {
    test.beforeEach(async ({ page }) => {
      await login(page, role as keyof typeof ACCOUNTS);
    });

    for (const shot of shots) {
      test(`${shot.name}`, async ({ page }, testInfo) => {
        await page.goto(shot.path, { waitUntil: "networkidle" });
        for (const theme of ["dark", "light"] as const) {
          await setTheme(page, theme);
          // Charts and any entrance transition settle before the shutter.
          await page.waitForTimeout(600);
          await page.screenshot({
            path: `e2e/.artifacts/screens/${testInfo.project.name}/${theme}/${role}-${shot.name}.png`,
            fullPage: true,
          });
        }
      });
    }
  });
}

test.describe("design evidence — unauthenticated states", () => {
  for (const [name, path] of [
    ["login", "/login"],
    ["not-found", "/dashboard/this-route-does-not-exist"],
  ] as const) {
    test(`${name}`, async ({ page }, testInfo) => {
      await page.goto(path, { waitUntil: "networkidle" });
      for (const theme of ["dark", "light"] as const) {
        await setTheme(page, theme);
        await page.screenshot({
          path: `e2e/.artifacts/screens/${testInfo.project.name}/${theme}/public-${name}.png`,
          fullPage: true,
        });
      }
    });
  }

  test("account-unavailable", async ({ page }, testInfo) => {
    await login(page, "orphan");
    for (const theme of ["dark", "light"] as const) {
      await setTheme(page, theme);
      await page.screenshot({
        path: `e2e/.artifacts/screens/${testInfo.project.name}/${theme}/public-account-unavailable.png`,
        fullPage: true,
      });
    }
  });
});
