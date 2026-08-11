import { test, expect, login, resetReviewFixture } from "./fixtures";

/**
 * Video review, end to end through the browser.
 *
 * The database boundaries — who reads which table, the superseded-version
 * rule, the private bucket — are proved by scripts/db/role-matrix.dbtest.mjs.
 * This suite drives the two surfaces built on top of them: the staff workspace
 * and the portal player, including one genuine file upload through the
 * session-client path with no service-role key anywhere in the run.
 *
 * All fixtures are fabricated; the uploaded "video" is a few hundred bytes of
 * generated data with a video/mp4 content type, which is exactly enough to
 * exercise validation, storage policies and signed URLs without committing
 * media anywhere.
 */

const ATLAS_ASSET = "f1000000-0000-4000-8000-000000000001";
const NOVA_ASSET = "f1000000-0000-4000-8000-000000000002";

test.describe("staff workspace", () => {
  test.beforeEach(async ({ page }) => {
    resetReviewFixture();
    await login(page, "admin");
  });

  test("lists the assets with their client and version", async ({ page, diagnostics }) => {
    await page.goto("/dashboard/review", { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    expect(body).toContain("Teaser gamme bio — montage");
    expect(body).toContain("Visite Lac 2 — montage");
    expect(body).toContain("v2"); // Atlas's current cut
    expect(diagnostics.significantErrors()).toEqual([]);
  });

  test("shows the conversation and resolves a client comment", async ({ page }) => {
    await page.goto(`/dashboard/review/${ATLAS_ASSET}`, { waitUntil: "networkidle" });

    // The seeded client remark, pinned to 0:03.
    await expect(page.getByText("le logo apparaît trop tôt")).toBeVisible();

    // Scoped to the card holding the client's remark: the agency's own seeded
    // comment is also unresolved, so an unscoped button locator matches twice.
    const clientCard = page
      .locator("li")
      .filter({ hasText: "le logo apparaît trop tôt" });
    await clientCard.getByRole("button", { name: "Marquer résolu" }).click();
    await expect(clientCard.getByText("Résolu", { exact: true })).toBeVisible();

    // And back, so the workflow is a toggle rather than a one-way door.
    await clientCard.getByRole("button", { name: "Rouvrir" }).click();
    await expect(clientCard.getByText("Résolu", { exact: true })).toHaveCount(0);
  });

  test("uploads a new version and previews it through a signed URL", async ({ page }) => {
    await page.goto(`/dashboard/review/${NOVA_ASSET}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Visite Lac 2 — montage")).toBeVisible();

    // A tiny generated payload with a video content type. Validation is by
    // declared type and size — the server does not decode frames.
    await page.setInputFiles('input[name="file"]', {
      name: "cut.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("PROBE fabricated video bytes ".repeat(32)),
    });
    await page.getByRole("button", { name: "Téléverser" }).click();

    // The fixture reset guarantees Nova had exactly v1, so this must be v2.
    // The header line reads "<client> · v<n>" — the client name, not the title.
    await expect(page.getByText("Nova Immobilier · v2")).toBeVisible({
      timeout: 20_000,
    });

    // The signed-URL path end to end: the button fetches a fresh URL and the
    // player mounts with it.
    await page.getByRole("button", { name: "Prévisualiser v2" }).click();
    await expect(page.locator("video")).toBeVisible();
  });

  test("refuses a file that is not a video", async ({ page }) => {
    await page.goto(`/dashboard/review/${NOVA_ASSET}`, { waitUntil: "networkidle" });

    await page.setInputFiles('input[name="file"]', {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("PROBE not a video"),
    });
    await page.getByRole("button", { name: "Téléverser" }).click();

    // Refused server-side — the accept attribute is a convenience, not a check.
    await expect(page.getByText("Le fichier doit être une vidéo.")).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("· v2");
  });
});

test.describe("portal player", () => {
  test.beforeEach(async ({ page }) => {
    resetReviewFixture();
    await login(page, "client");
  });

  test("shows the review, its conversation, and no employee name", async ({
    page,
    diagnostics,
  }) => {
    await page.goto(`/portal/review/${ATLAS_ASSET}`, { waitUntil: "networkidle" });

    await expect(page.getByText("Teaser gamme bio — montage")).toBeVisible();
    await expect(page.getByText("version 2")).toBeVisible();

    // The seeded file was never uploaded, so the player degrades honestly
    // while the conversation stays fully usable.
    await expect(page.getByText("Aperçu indisponible")).toBeVisible();
    await expect(page.getByText("le logo apparaît trop tôt")).toBeVisible();

    // The agency replied — as the agency, never as a named employee.
    const body = await page.locator("body").innerText();
    expect(body).toContain("Areen CUBs");
    expect(body).not.toContain("Staging Worker");

    expect(diagnostics.significantErrors()).toEqual([]);
  });

  test("posts a comment on the current version", async ({ page }) => {
    await page.goto(`/portal/review/${ATLAS_ASSET}`, { waitUntil: "networkidle" });

    await page.fill("#portal-review-comment", "PROBE-retour du client sur la v2");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(
      page.getByText("PROBE-retour du client sur la v2").first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("another organisation's review is a 404, not a refusal", async ({ page }) => {
    // Nova's asset, reached by id. The page must be indistinguishable from a
    // missing one — a distinct "forbidden" would confirm the id exists.
    const res = await page.goto(`/portal/review/${NOVA_ASSET}`, {
      waitUntil: "networkidle",
    });
    expect(res?.status()).toBe(404);
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Visite Lac 2");
  });

  test("the portal home lists the review with its status", async ({ page }) => {
    await page.goto("/portal", { waitUntil: "networkidle" });
    await expect(page.getByText("Vidéos à visionner")).toBeVisible();
    await expect(page.getByText("Teaser gamme bio — montage")).toBeVisible();
  });
});
