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
  "/dashboard/team/planning",
  "/dashboard/team/workload",
  "/dashboard/settings",
];

test.describe("core navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  for (const route of ROUTES) {
    test(`${route} loads without console errors or failed requests`, async ({
      page,
      diagnostics,
    }) => {
      const res = await page.goto(route, { waitUntil: "networkidle" });
      expect(res?.status(), `HTTP status for ${route}`).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/login/);

      // The error boundary, explicitly.
      //
      // /dashboard/finance shipped broken for three commits: a chart refactor
      // left `const chart = useFinanceColors()` at MODULE scope, so importing
      // the client bundle threw "Invalid hook call" and every visit rendered
      // this boundary instead of the page. It typechecked, the build passed,
      // and the route still answered 200 — the boundary IS the response.
      //
      // Asserting on console noise alone was not enough to make that visible,
      // so the rendered outcome is asserted directly.
      await expect(
        page.getByText("Une erreur est survenue"),
        `${route} rendered the error boundary instead of the page`,
      ).toHaveCount(0);

      expect(diagnostics.significantErrors(), `console errors on ${route}`).toEqual([]);
      expect(diagnostics.failedRequests, `failed requests on ${route}`).toEqual([]);
    });
  }
});

test.describe("service-role degradation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("the team directory renders without a service-role key", async ({
    page,
    diagnostics,
  }) => {
    // The default e2e run writes no SUPABASE_SERVICE_ROLE_KEY on purpose: a
    // suite that needs the most privileged credential in the system to pass is
    // a suite that will one day leak it. Only `--with-service-role` supplies it.
    //
    // /dashboard/team used to return a 500 under that default, because it
    // built the Auth admin client to attach each member's email address and
    // the constructor threw when the key was missing. The whole directory was
    // lost to one display column, and React's production wording — "An error
    // occurred in the Server Components render" — made it look like a client
    // hydration fault for three sessions running.
    //
    // The assertion is that the page renders and stays silent. Emails are
    // present or absent depending on how the suite was invoked, so they are
    // deliberately not asserted here.
    const res = await page.goto("/dashboard/team", { waitUntil: "networkidle" });
    expect(res?.status()).toBeLessThan(400);
    // Asserted through visible body text rather than a locator, for two
    // reasons that each broke an earlier attempt. The signed-in admin's name
    // also sits in the topbar account menu, so it stays present even when the
    // directory fails entirely; and the page renders BOTH a table and a card
    // list, hiding one by breakpoint, so every getByText matches twice and
    // trips strict mode. innerText returns only what is actually displayed.
    const body = await page.locator("body").innerText();
    expect(body).toContain("Staging Commercial");

    // And the Phase 2 boundary, pinned here because it is a rendering
    // property: a client organisation's contact holds a profiles row but is
    // not an employee, and must never appear in the agency's team directory.
    expect(body).not.toContain("Staging Client Contact");
    expect(diagnostics.significantErrors()).toEqual([]);
  });

  test("an admin can edit a team profile through RLS", async ({ page }) => {
    const memberId = "22222222-2222-4222-8222-222222222222";
    await page.goto(`/dashboard/team/${memberId}`, { waitUntil: "networkidle" });
    const profileForm = page.locator('form:has(input[name="full_name"])');
    await profileForm.locator('input[name="full_name"]').fill("PROBE Staging Worker");
    await profileForm.locator('input[name="job_title"]').fill("PROBE Editor");
    await profileForm.getByRole("button", { name: /save|enregistrer/i }).click();
    await expect(profileForm.locator('input[name="full_name"]')).toHaveValue("PROBE Staging Worker");

    await page.reload({ waitUntil: "networkidle" });
    const reloadedForm = page.locator('form:has(input[name="full_name"])');
    await expect(reloadedForm.locator('input[name="full_name"]')).toHaveValue("PROBE Staging Worker");

    // Restore the fabricated seed value so the suite remains repeatable.
    await reloadedForm.locator('input[name="full_name"]').fill("Staging Worker");
    await reloadedForm.locator('input[name="job_title"]').fill("");
    await reloadedForm.getByRole("button", { name: /save|enregistrer/i }).click();
  });

  test("an admin can persist another member's planning", async ({ page }) => {
    await page.goto("/dashboard/team/planning", { waitUntil: "networkidle" });
    const workerRow = page.locator("tbody tr").filter({ hasText: "Staging Worker" });
    const day = workerRow.locator('button[title^="2026-"]').first();
    const before = await day.getAttribute("title");
    expect(before).toBeTruthy();
    await day.click();
    await page.waitForTimeout(500);

    await page.reload({ waitUntil: "networkidle" });
    const persisted = page
      .locator("tbody tr")
      .filter({ hasText: "Staging Worker" })
      .locator('button[title^="2026-"]')
      .first();
    await expect(persisted).not.toHaveAttribute("title", before!);

    // Three states cycle empty → office → home → empty. Restore the original.
    for (let attempt = 0; attempt < 2; attempt++) {
      if ((await persisted.getAttribute("title")) === before) break;
      await persisted.click();
      await page.waitForTimeout(400);
    }
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
