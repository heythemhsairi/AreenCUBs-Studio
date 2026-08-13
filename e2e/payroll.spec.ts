import { expect, login, resetPayrollFixture, test } from "./fixtures";

test.describe("worker payroll", () => {
  test.beforeEach(async ({ page }) => {
    resetPayrollFixture();
    await login(page, "worker");
  });
  test.afterEach(() => resetPayrollFixture());

  test("shows only the worker's task points, value, target and payment history", async ({ page, diagnostics }) => {
    await page.goto("/dashboard/payroll", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    expect(body).toContain("Mes points & salaire");
    expect(body).toContain("50,00 DT"); // 40 DT video + 10 DT manager bonus
    expect(body).toContain("650,00 DT");
    expect(body).toMatch(/Points de production[·\s]+1[·\s]+volume, sans valeur monétaire/);
    expect(body).toContain("Paiement calculé");
    expect(body).toContain("0,00 DT");
    expect(diagnostics.significantErrors()).toEqual([]);
  });
});

test.describe("admin payroll controls", () => {
  test.beforeEach(async ({ page }) => {
    resetPayrollFixture();
    await login(page, "admin");
  });
  test.afterEach(() => resetPayrollFixture());

  test("edits a rate and recalculates the current month immediately", async ({ page }) => {
    await page.goto("/dashboard/payroll", { waitUntil: "networkidle" });
    const videoForm = page.locator("form").filter({ has: page.locator('input[value="Vidéo"]') });
    await videoForm.locator('input[name="base_rate_dt"]').fill("41");
    await videoForm.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("status")).toContainText("enregistrées");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("51,00 DT");
  });

  test("classifies a completed task and credits it to the selected worker", async ({ page }) => {
    await page.goto("/dashboard/tasks/new?projectId=e1000000-0000-4000-8000-000000000003", { waitUntil: "networkidle" });
    await page.getByLabel("Titre").fill("PROBE-payroll post terminé");
    await page.getByLabel("Statut").selectOption("done");
    await page.getByLabel("Type de production").selectOption({ label: "Post · 1 pt · 8.000 DT" });
    await page.getByLabel("Collaborateur crédité").selectOption("22222222-2222-4222-8222-222222222222");
    await page.getByRole("button", { name: "Créer" }).click();
    await expect(page).toHaveURL(/\/dashboard\/projects\//);

    await page.goto("/dashboard/payroll", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("58,00 DT");
  });
});
