import { test, expect, login, ACCOUNTS } from "./fixtures";

/**
 * Authentication and authorization at the browser layer.
 *
 * NOTE: the missing-profile test below proves the UI denies an unprovisioned
 * user. It does NOT resolve the Content OS database vulnerability recorded in
 * DECISIONS-NEEDED.md §1b — that identity can still reach the data directly
 * through PostgREST, which is proven separately in
 * scripts/db/content-os.dbtest.mjs. UI rejection is not a security boundary.
 */

test.describe("login", () => {
  test("an unauthenticated visitor is sent to the login page", async ({ page, diagnostics }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[name="username"]')).toBeVisible();
    expect(diagnostics.significantErrors()).toEqual([]);
  });

  test("invalid credentials are rejected and do not reach the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "definitely-the-wrong-password");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test("an unknown user is rejected", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="username"]', "nobody-at-all");
    await page.fill('input[name="password"]', "staging-only-not-a-secret");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test("a synthetic admin reaches the dashboard", async ({ page, diagnostics }) => {
    await login(page, "admin");
    await expect(page).toHaveURL(/\/dashboard/);
    expect(diagnostics.failedRequests).toEqual([]);
  });
});

test.describe("fail-closed: authenticated but no profile", () => {
  test("the orphan account never reaches the dashboard", async ({ page }) => {
    await login(page, "orphan");
    // Phase 1d: denial routes to /account-unavailable, NOT /login, because the
    // middleware would bounce an authenticated user off /login indefinitely.
    await expect(page).not.toHaveURL(/\/dashboard$/);
    await expect(page).toHaveURL(/account-unavailable/);
  });

  test("the denial page explains nothing about which check failed", async ({ page }) => {
    await login(page, "orphan");
    const body = (await page.locator("body").innerText()).toLowerCase();
    // Authenticated-but-unauthorised: naming the cause would tell an attacker
    // which half of the check they cleared.
    expect(body).not.toMatch(/profile.*not found|no profiles row|missing row/);
    expect(body).toMatch(/compte non configur|not yet linked|administrator/i);
  });

  test("the orphan cannot reach a protected route directly", async ({ page }) => {
    await login(page, "orphan");
    for (const route of ["/dashboard/clients", "/dashboard/finance", "/dashboard/content"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/account-unavailable/);
    }
  });

  test("signing out from the denial page returns to login", async ({ page }) => {
    await login(page, "orphan");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("role scoping in the UI", () => {
  test("a freelancer does not see admin-only navigation", async ({ page }) => {
    await login(page, "freelancer");
    await expect(page).toHaveURL(/\/dashboard/);
    const nav = (await page.locator("body").innerText()).toLowerCase();
    // Finance and team management are admin territory.
    expect(nav).not.toContain("admin tasks");
  });

  test("an admin sees the finance module", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/finance");
    await expect(page).toHaveURL(/finance/);
  });

  test("a freelancer is redirected away from finance", async ({ page }) => {
    await login(page, "freelancer");
    await page.goto("/dashboard/finance");
    // requireWorkerOrAdmin sends freelancers back to the dashboard.
    await expect(page).toHaveURL(/\/dashboard(?!\/finance)/);
  });
});
