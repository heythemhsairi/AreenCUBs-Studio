import { test, login } from "./fixtures";

/**
 * Design evidence capture — fabricated data only.
 *
 * Not an assertion suite. It records what the corrected palette actually
 * looks like at each viewport so hierarchy, typography and brand identity can
 * be reviewed by eye, which axe cannot judge.
 *
 * Run explicitly:
 *   npx playwright test screenshots --project=desktop --project=tablet --project=mobile
 *
 * Output lands in e2e/.artifacts/screens/, which is gitignored — the images
 * are evidence for a review, not repository content. Every screen shows the
 * synthetic seed: fabricated clients, invented amounts, `.invalid` domains.
 */

const ROUTES: [string, string][] = [
  ["dashboard", "/dashboard"],
  ["tasks", "/dashboard/tasks"],
  ["clients", "/dashboard/clients"],
  ["projects", "/dashboard/projects"],
  ["finance", "/dashboard/finance"],
  ["content", "/dashboard/content"],
  ["review", "/dashboard/review"],
  ["reports", "/dashboard/reports"],
  ["audit", "/dashboard/audit"],
  ["settings", "/dashboard/settings"],
];

test.describe("design evidence", () => {
  test("login page", async ({ page }, testInfo) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.screenshot({
      path: `e2e/.artifacts/screens/${testInfo.project.name}/login.png`,
      fullPage: true,
    });
  });

  test.describe("authenticated", () => {
    test.beforeEach(async ({ page }) => {
      await login(page, "admin");
    });

    for (const [name, route] of ROUTES) {
      test(`${name}`, async ({ page }, testInfo) => {
        await page.goto(route, { waitUntil: "networkidle" });
        // Let charts and any entrance animation settle so the capture is stable.
        await page.waitForTimeout(900);
        await page.screenshot({
          path: `e2e/.artifacts/screens/${testInfo.project.name}/${name}.png`,
          fullPage: true,
        });
      });
    }

    test("account-unavailable denial page", async ({ page, context }, testInfo) => {
      await context.clearCookies();
      await login(page, "orphan");
      await page.screenshot({
        path: `e2e/.artifacts/screens/${testInfo.project.name}/account-unavailable.png`,
        fullPage: true,
      });
    });
  });
});
