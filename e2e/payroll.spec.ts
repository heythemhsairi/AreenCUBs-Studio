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

  test("shows the monthly payroll summary directly on the worker dashboard", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Mes points ce mois" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir le détail" })).toHaveAttribute("href", "/dashboard/payroll");
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

  test("adds and deletes an unused task type", async ({ page }) => {
    await page.goto("/dashboard/payroll", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Ajouter un type" }).click();
    const newType = page.locator("form").filter({ hasText: "Nouveau type de tâche" });
    await newType.getByLabel("Type").fill("PROBE-payroll Animation");
    await newType.getByLabel("Tarif de base (DT)").fill("12.500");
    await newType.getByLabel("Au-dessus du seuil (DT)").fill("18.750");
    await newType.getByLabel("Points").fill("3");
    await newType.getByRole("button", { name: "Créer le type" }).click();
    await expect(page.getByRole("status")).toContainText("enregistrées");

    const savedType = page.locator("form").filter({ has: page.locator('input[value="PROBE-payroll Animation"]') });
    await expect(savedType).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await savedType.getByRole("button", { name: "Supprimer PROBE-payroll Animation" }).click();
    await expect(page.getByRole("status")).toContainText("enregistrées");
    await expect(page.locator('input[value="PROBE-payroll Animation"]')).toHaveCount(0);

    const usedType = page.locator("form").filter({ has: page.locator('input[value="Vidéo"]') });
    page.once("dialog", (dialog) => dialog.accept());
    await usedType.getByRole("button", { name: "Supprimer Vidéo" }).click();
    await expect(page.getByRole("status")).toContainText("Désactivez-le au lieu de le supprimer");
    await expect(usedType).toBeVisible();
  });

  test("classifies a completed task and credits it to the selected worker", async ({ page }) => {
    await page.goto("/dashboard/tasks/new?projectId=e1000000-0000-4000-8000-000000000003", { waitUntil: "networkidle" });
    await page.getByLabel("Titre").fill("PROBE-payroll post terminé");
    await page.getByLabel("Statut").selectOption("done");
    await page.getByLabel("Type de production").selectOption({ label: "Post · 1 pt · 8.000 DT" });
    await page.getByLabel("Collaborateur crédité").selectOption("22222222-2222-4222-8222-222222222222");
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/projects\//);

    await page.goto("/dashboard/payroll", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("58,00 DT");
  });
});

for (const role of ["commercial", "intern", "freelancer", "client"] as const) {
  test(`${role} cannot open worker payroll`, async ({ page }) => {
    await login(page, role);
    await page.goto("/dashboard/payroll", { waitUntil: "networkidle" });
    await expect(page).not.toHaveURL(/\/dashboard\/payroll/);
  });
}
