import { test, expect, login } from "./fixtures";

test.describe("collaboration hub", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("messages carry person, task and section links, and reminders can be managed", async ({ page, diagnostics }) => {
    const messageBody = "PROBE Merci pour ton aide sur cette mission";
    const reminderTitle = "PROBE vérifier le suivi";

    await page.goto("/dashboard/messages", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Messages/ })).toBeVisible();

    const messageForm = page.locator("form").filter({ has: page.locator('textarea[name="body"]') });
    await messageForm.locator('textarea[name="body"]').fill(messageBody);
    await messageForm.getByRole("button", { name: /@worker/ }).click();
    await messageForm.locator('select[name="task_id"]').selectOption({ index: 1 });
    await messageForm.locator('select[name="section_path"]').selectOption("/dashboard/studio-tasks");
    await messageForm.getByRole("button", { name: /Envoyer|Send/ }).click();

    const message = page.locator("article").filter({ hasText: messageBody });
    await expect(message).toBeVisible();
    await expect(message.locator('a[href^="/dashboard/tasks/"]')).toHaveCount(1);
    await expect(message.locator('a[href="/dashboard/studio-tasks"]')).toHaveCount(1);

    const reminderForm = page.locator("form").filter({ has: page.locator('input[name="remind_at"]') });
    await reminderForm.locator('input[name="title"]').fill(reminderTitle);
    await reminderForm.locator('input[name="remind_at"]').fill("2030-01-01T09:00");
    await reminderForm.locator('select[name="section_path"]').selectOption("/dashboard/studio-tasks");
    await reminderForm.getByRole("button", { name: /Ajouter le rappel|Add reminder/ }).click();

    const reminder = page.locator("li").filter({ hasText: reminderTitle });
    await expect(reminder).toBeVisible();
    await expect(reminder.locator('a[href="/dashboard/studio-tasks"]')).toHaveCount(1);

    await reminder.getByRole("button", { name: /Supprimer le rappel|Delete reminder/ }).click();
    await expect(reminder).toHaveCount(0);
    await message.getByRole("button", { name: /Supprimer le message|Delete message/ }).click();
    await expect(message).toHaveCount(0);

    expect(diagnostics.significantErrors()).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
  });

  test("Areen tasks stay separate from client work", async ({ page, diagnostics }) => {
    const title = "PROBE Areen internal separation";

    await page.goto("/dashboard/studio-tasks/new", { waitUntil: "networkidle" });
    await expect(page.getByText(/Travail interne Areen|Internal Areen work/)).toBeVisible();
    await page.locator('input[name="title"]').fill(title);
    await page.getByRole("button", { name: /Créer|Create/, exact: true }).click();

    await page.waitForURL(/\/dashboard\/studio-tasks$/);
    await expect(page.locator("main").getByText(title, { exact: true })).toBeVisible();

    await page.goto("/dashboard/tasks", { waitUntil: "networkidle" });
    await expect(page.locator("main").getByText(title, { exact: true })).toHaveCount(0);

    await page.goto("/dashboard/studio-tasks", { waitUntil: "networkidle" });
    await page.locator("main").getByText(title, { exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Supprimer cette tâche|Delete this task/ }).click();
    await page.waitForURL(/\/dashboard\/studio-tasks$/);

    expect(diagnostics.significantErrors()).toEqual([]);
    expect(diagnostics.failedRequests).toEqual([]);
  });
});
