import { test, expect, login, resetPortalApprovalFixture } from "./fixtures";

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

    // NOT_OWNED is Atlas Foods, which is this contact's OWN organisation — it
    // is named "not owned" from the commercial's point of view, not the
    // client's. Written when /portal was a placeholder with no content at all,
    // this asserted the portal never showed it, which stopped being true the
    // moment the portal started working.
    //
    // What must stay absent is every OTHER organisation and every employee.
    for (const internal of [OWNED, OWNED_TOO, "Staging Worker", "Staging Admin"]) {
      expect(body, `portal leaked "${internal}"`).not.toContain(internal);
    }
    expect(body).toContain(NOT_OWNED);
  });
});

test.describe("client portal — what it shows and what it refuses", () => {
  test.beforeEach(async ({ page }) => {
    // Two of these tests record a real decision that outlives the test, so the
    // pending item is restored first. Without it the suite passes once.
    resetPortalApprovalFixture();
    await login(page, "client");
    await page.goto("/portal", { waitUntil: "networkidle" });
  });

  test("shows the organisation and the content awaiting a decision", async ({
    page,
    diagnostics,
  }) => {
    const body = await page.locator("body").innerText();

    expect(body).toContain("Atlas Foods SARL");
    expect(body).toContain("Teaser gamme bio");        // awaiting review
    expect(body).toContain("Recette estivale");        // already approved

    expect(diagnostics.significantErrors()).toEqual([]);
  });

  test("hides work still in production, and every other organisation's content", async ({
    page,
  }) => {
    const body = await page.locator("body").innerText();

    // Atlas's own item, still in 'design'. A client sees work once it is put
    // in front of them, not while it is being made.
    expect(body, "portal showed an item still in internal production").not.toContain(
      "Coulisses production",
    );

    // Nova's item, in a client-visible status. Membership is the only thing
    // stopping it, which is exactly what this asserts.
    expect(body, "portal showed another organisation's content").not.toContain(
      "Visite guidée Lac 2",
    );
  });

  test("shows no internal field anywhere on the page", async ({ page }) => {
    const body = await page.locator("body").innerText();
    for (const internal of ["Staging Worker", "urgent", "Priorité", "Deadline interne"]) {
      expect(body, `portal leaked "${internal}"`).not.toContain(internal);
    }
  });

  test("records an approval, and the item leaves the pending list", async ({ page }) => {
    const pending = page.getByText("Teaser gamme bio");
    await expect(pending).toBeVisible();

    await page.getByRole("button", { name: "Valider" }).click();

    // The action revalidates /portal, and the item re-renders under "Vos
    // contenus" carrying the decision. It stays in 'client_review' internally,
    // which is correct — the client answered, the agency has not yet acted.
    await expect(page.getByText("Validé par vous")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Valider" })).toHaveCount(0);
  });

  test("a revision request without a comment is refused", async ({ page }) => {
    // Not a database rule — an empty revision request is valid SQL and useless
    // to the team, so the action rejects it and the page says why.
    await page.getByRole("button", { name: "Demander une modification" }).click();
    // Located by its text, not by role: Next.js renders its own route
    // announcer with role="alert", so an unscoped alert locator matches twice
    // and trips strict mode.
    await expect(page.getByText("Merci d'indiquer")).toBeVisible();
  });
});
