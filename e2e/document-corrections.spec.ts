import {
  test,
  expect,
  login,
  resetDocumentCorrectionFixtures,
} from "./fixtures";

test.describe("issued document corrections", () => {
  test.beforeEach(async ({ page }) => {
    resetDocumentCorrectionFixtures(true);
    await login(page, "admin");
  });

  test.afterEach(() => {
    resetDocumentCorrectionFixtures();
  });

  test("reopens and saves an accepted invoice after client confirmation", async ({
    page,
    diagnostics,
  }) => {
    await page.goto(
      "/dashboard/factures/d1000000-0000-4000-8000-000000000001/edit",
      { waitUntil: "networkidle" },
    );

    const save = page.getByRole("button", {
      name: /remettre en brouillon et enregistrer/i,
    });
    await expect(save).toBeDisabled();

    const linePrice = page.locator('input[type="number"][step="0.01"]').first();
    await linePrice.fill("1100");
    await page
      .getByLabel(/je confirme avoir informé le client/i)
      .check();
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page).toHaveURL(
      /\/dashboard\/factures\/d1000000-0000-4000-8000-000000000001$/,
    );
    await expect(page.getByText("Brouillon", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Partiel", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/1[\s\u00a0]100,00\s*DT/).first()).toBeVisible();
    expect(diagnostics.significantErrors()).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
  });

  test("preserves a historical no-TVA quote while reopening it", async ({ page }) => {
    await page.goto(
      "/dashboard/devis/d1000000-0000-4000-8000-000000000007/edit",
      { waitUntil: "networkidle" },
    );

    const tvaToggle = page.getByRole("checkbox", { name: /TVA \(19%\)/i });
    await expect(tvaToggle).not.toBeChecked();
    await page
      .getByLabel(/je confirme avoir informé le client/i)
      .check();
    await page
      .getByRole("button", { name: /remettre en brouillon et enregistrer/i })
      .click();

    await expect(page).toHaveURL(
      /\/dashboard\/devis\/d1000000-0000-4000-8000-000000000007$/,
    );
    await expect(page.getByText("Brouillon", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/TVA \(19%\)/)).toHaveCount(0);
  });
});
