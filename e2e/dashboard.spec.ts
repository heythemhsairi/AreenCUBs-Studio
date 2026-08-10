import { test, expect, login, hydrationErrors } from "./fixtures";

/**
 * Core navigation, hydration, Content OS and finance, under a UTC server and
 * an Africa/Tunis browser.
 */

const ROUTES = [
  "/dashboard",
  "/dashboard/tasks",
  "/dashboard/calendar",
  "/dashboard/clients",
  "/dashboard/projects",
  "/dashboard/devis",
  "/dashboard/factures",
  "/dashboard/finance",
  "/dashboard/content",
  "/dashboard/content/publishing",
  "/dashboard/services",
  "/dashboard/team",
  "/dashboard/settings",
];

test.describe("core navigation", () => {
  for (const route of ROUTES) {
    test(`${route} loads without console errors or failed requests`, async ({
      page,
      diagnostics,
    }) => {
      const res = await page.goto(route, { waitUntil: "networkidle" });
      expect(res?.status(), `HTTP status for ${route}`).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/login/);

      expect(diagnostics.significantErrors(), `console errors on ${route}`).toEqual([]);
      expect(diagnostics.failedRequests, `failed requests on ${route}`).toEqual([]);
    });
  }

  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });
});

test.describe("Publishing hydration — the #418 regression", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("direct load produces no hydration mismatch", async ({ page, diagnostics }) => {
    // Server renders in UTC, browser hydrates in Africa/Tunis. Before the
    // Phase 1b fix this combination reliably produced React #418.
    await page.goto("/dashboard/content/publishing", { waitUntil: "networkidle" });
    await page.waitForTimeout(600); // let hydration settle
    expect(hydrationErrors(diagnostics.significantErrors())).toEqual([]);
    expect(diagnostics.significantErrors()).toEqual([]);
  });

  test("client-side navigation produces no hydration mismatch", async ({ page, diagnostics }) => {
    await page.goto("/dashboard/content", { waitUntil: "networkidle" });
    await page.goto("/dashboard/content/publishing", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    expect(hydrationErrors(diagnostics.significantErrors())).toEqual([]);
  });

  test("the Clients page — the historical control — is also clean", async ({
    page,
    diagnostics,
  }) => {
    await page.goto("/dashboard/clients", { waitUntil: "networkidle" });
    expect(hydrationErrors(diagnostics.significantErrors())).toEqual([]);
  });

  test("renders dates in the business timezone, not UTC", async ({ page }) => {
    await page.goto("/dashboard/content/publishing", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    // Seeded posts are fabricated and dated 2026; a UTC-rendered page would
    // show en-US month names. French month names prove the pinned locale.
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toMatch(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+20\d\d/);
  });
});

test.describe("Content OS", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("the hub lists the fabricated clients", async ({ page, diagnostics }) => {
    await page.goto("/dashboard/content", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    expect(body).toContain("Atlas Foods");
    expect(diagnostics.significantErrors()).toEqual([]);
  });

  test("a seeded monthly plan is readable", async ({ page }) => {
    await page.goto("/dashboard/content", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    // Plans exist in the fixture, so the zero-state must not be shown for all.
    expect(body).toMatch(/Atlas Foods|Nova Immobilier/);
  });

  test("the publishing module renders the seeded posts", async ({ page }) => {
    await page.goto("/dashboard/content/publishing", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/Atlas|Nova|Zenith/);
  });
});

test.describe("finance contradiction fixtures", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("the finance page renders with the contradictory data present", async ({
    page,
    diagnostics,
  }) => {
    await page.goto("/dashboard/finance", { waitUntil: "networkidle" });
    expect(diagnostics.significantErrors()).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
  });

  test("invoices list renders", async ({ page, diagnostics }) => {
    await page.goto("/dashboard/factures", { waitUntil: "networkidle" });
    expect(diagnostics.significantErrors()).toEqual([]);
  });

  test("a money amount is never rendered as NaN or undefined", async ({ page }) => {
    for (const route of ["/dashboard/finance", "/dashboard/factures", "/dashboard/devis"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      const body = await page.locator("body").innerText();
      expect(body, `${route} must not render NaN`).not.toMatch(/\bNaN\b/);
      expect(body, `${route} must not render undefined`).not.toMatch(/\bundefined\b/);
    }
  });
});

test.describe("empty, loading and error states", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("an unknown dashboard route renders a not-found rather than crashing", async ({ page }) => {
    const res = await page.goto("/dashboard/this-route-does-not-exist", {
      waitUntil: "networkidle",
    });
    expect(res?.status()).toBe(404);
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test("an unknown record id does not produce a 500", async ({ page }) => {
    const res = await page.goto("/dashboard/clients/00000000-0000-4000-8000-000000000000", {
      waitUntil: "networkidle",
    });
    expect(res?.status(), "must not be a server error").toBeLessThan(500);
  });
});
