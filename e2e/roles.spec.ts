import { test, expect, login } from "./fixtures";

/**
 * Role scoping, observed through the browser.
 *
 * The database side is proved by scripts/db/role-matrix.dbtest.mjs, which
 * asserts rows visible and rows affected for every role. This suite asks the
 * different question that only a browser can answer: does the rendered page
 * agree with the policy, and does a guard actually redirect?
 *
 * The negative assertions matter more than the positive ones. "The commercial
 * sees their own client" would still pass if the page also showed every other
 * client in the agency, so each test names a fixture the role must NOT reach
 * and asserts its absence from the visible text.
 *
 * All fixtures are fabricated. See supabase/seed.sql.
 */

/** Clients the commercial owns, and one they must never see. */
const OWNED = "Nova Immobilier";
const OWNED_TOO = "Meridian Logistique";
const NOT_OWNED = "Atlas Foods SARL";

test.describe("commercial — dashboard scope", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "commercial");
  });

  test("lands on the commercial dashboard, not the agency overview", async ({
    page,
    diagnostics,
  }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();

    // Their own book, both routes into ownership: one client by an explicit
    // client_members assignment, one by authorship.
    expect(body).toContain(OWNED);
    expect(body).toContain(OWNED_TOO);

    // And the client that belongs to nobody's commercial. If this ever
    // appears, either the policy or the early return in page.tsx has broken.
    expect(body).not.toContain(NOT_OWNED);

    expect(diagnostics.significantErrors()).toEqual([]);
  });

  test("sees no agency-wide finance figures", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();

    // The admin overview's own KPI labels. A commercial reaching any of these
    // means the early return was bypassed and the global queries ran.
    for (const agencyOnly of ["Encaissé", "Marge", "Impayés"]) {
      expect(body, `agency KPI "${agencyOnly}" leaked to a commercial`).not.toContain(
        agencyOnly,
      );
    }
  });

  test("is redirected away from the agency finance page", async ({ page }) => {
    // requireAdmin. The redirect is the assertion — a commercial must not be
    // able to reach agency finance by typing the URL.
    await page.goto("/dashboard/finance", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/dashboard\/?$/);
  });

  test("reaches the quote list, scoped to their own clients", async ({ page }) => {
    await page.goto("/dashboard/devis", { waitUntil: "networkidle" });
    await expect(page).not.toHaveURL(/\/dashboard\/?$/);

    const body = await page.locator("body").innerText();
    expect(body).not.toContain(NOT_OWNED);
  });

  test("is redirected away from team administration", async ({ page }) => {
    await page.goto("/dashboard/team", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/dashboard\/?$/);
  });
});

test.describe("intern — reduced surface", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "intern");
  });

  test("sees the tasks assigned to them and nothing else", async ({
    page,
    diagnostics,
  }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();

    // The intern's open task. Their other assigned task is already 'done' and
    // is counted in the KPI rather than listed, so asserting on that one would
    // fail for a page that is behaving correctly.
    expect(body).toContain("Préparer la revue de contenu");

    // Tasks belonging to other people, on projects the intern is not on.
    for (const foreign of ["Charte graphique", "Rapport de performance"]) {
      expect(body, `intern saw unassigned task "${foreign}"`).not.toContain(foreign);
    }
    expect(diagnostics.significantErrors()).toEqual([]);
  });

  test("reads its client through the reduced directory, never the notes", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();

    // The client behind the assigned task, by name.
    expect(body).toContain("Zenith Fitness");

    // And nothing the clients TABLE carries. An intern holds no policy on that
    // table at all, precisely because the row contains internal commentary and
    // RLS cannot withhold a single column.
    expect(body).not.toContain("FABRICATED staging client");
    expect(body).not.toContain("FAKE-0000003CCC000");
    expect(body).not.toContain(NOT_OWNED);
  });

  test("sees no finance surface and is redirected from the agency pages", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    for (const financeWord of ["Encaissé", "Marge", "Impayés", "Pipeline"]) {
      expect(body, `finance term "${financeWord}" leaked to an intern`).not.toContain(
        financeWord,
      );
    }

    for (const route of ["/dashboard/finance", "/dashboard/devis", "/dashboard/team"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page, `intern reached ${route}`).toHaveURL(/\/dashboard\/?$/);
    }
  });
});

test.describe("client contact — no internal surface", () => {
  test("signing in never reaches the dashboard", async ({ page }) => {
    await login(page, "client");

    // The middleware sends every authenticated user from /login to /dashboard;
    // the internal guard then sends this one on to the portal. One hop, and
    // deliberately not a loop — /portal admits only the client role, so
    // neither guard can bounce back into the other.
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/portal/);
  });

  test("cannot reach clients, tasks or finance by URL", async ({ page }) => {
    await login(page, "client");
    for (const route of [
      "/dashboard/clients",
      "/dashboard/tasks",
      "/dashboard/finance",
      "/dashboard/devis",
      "/dashboard/team",
    ]) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page, `client reached ${route}`).toHaveURL(/\/portal/);
    }
  });

  test("the portal shows nothing about the agency", async ({ page }) => {
    await login(page, "client");
    await page.goto("/portal", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();

    for (const internal of [NOT_OWNED, OWNED, "Staging Worker", "Staging Admin"]) {
      expect(body, `portal leaked "${internal}"`).not.toContain(internal);
    }
  });
});
