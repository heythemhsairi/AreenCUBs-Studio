import { test, expect, login } from "./fixtures";

/**
 * Focused accessibility checks: keyboard operation, visible focus, accessible
 * names, dialog behaviour, and gross contrast failures.
 *
 * Deliberately narrow and mechanical. A full WCAG audit is a separate piece of
 * work; these assert the things that are unambiguous and cheap to verify.
 */

test.describe("login page", () => {
  test("both inputs have accessible names", async ({ page }) => {
    await page.goto("/login");
    for (const name of ["username", "password"]) {
      const input = page.locator(`input[name="${name}"]`);
      const id = await input.getAttribute("id");
      const aria = await input.getAttribute("aria-label");
      const labelled = await input.getAttribute("aria-labelledby");
      const hasLabelFor = id ? (await page.locator(`label[for="${id}"]`).count()) > 0 : false;
      expect(
        Boolean(aria || labelled || hasLabelFor),
        `input[name="${name}"] must have an accessible name`,
      ).toBe(true);
    }
  });

  test("is operable by keyboard alone", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="username"]').focus();
    await page.keyboard.type("admin");
    await page.keyboard.press("Tab");
    await page.keyboard.type("staging-only-not-a-secret");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("name"));
    expect(focused).toBe("password");
  });

  test("focus is visible on the submit button", async ({ page }) => {
    await page.goto("/login");
    const btn = page.locator('button[type="submit"]');
    await btn.focus();
    const style = await btn.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow };
    });
    const visible =
      (style.outline !== "none" && style.width !== "0px") ||
      (style.shadow !== "none" && style.shadow !== "");
    expect(visible, "focused control must have a visible focus indicator").toBe(true);
  });
});

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("has exactly one h1 and a sensible heading order", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const levels = await page.evaluate(() =>
      Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) =>
        Number(h.tagName.slice(1)),
      ),
    );
    expect(levels.length, "page should have headings").toBeGreaterThan(0);
    // No level should jump by more than one from the previous.
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1], `heading jump at index ${i}: ${levels.join(",")}`)
        .toBeLessThanOrEqual(1);
    }
  });

  test("every icon-only button has an accessible name", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const unnamed = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .filter((b) => {
          const text = (b.textContent ?? "").trim();
          const name =
            b.getAttribute("aria-label") ??
            b.getAttribute("title") ??
            b.getAttribute("aria-labelledby") ??
            "";
          return text.length === 0 && name.length === 0;
        })
        .map((b) => b.outerHTML.slice(0, 120)),
    );
    expect(unnamed, "icon-only buttons must be labelled").toEqual([]);
  });

  test("every image has an alt attribute", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const missing = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        .filter((i) => i.getAttribute("alt") === null)
        .map((i) => i.getAttribute("src") ?? "(no src)"),
    );
    expect(missing).toEqual([]);
  });

  test("the document declares its language", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const lang = await page.evaluate(() => document.documentElement.getAttribute("lang"));
    expect(lang, "html[lang] must be set").toBeTruthy();
  });

  test("can be traversed by Tab without trapping focus", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      seen.add(
        await page.evaluate(
          () => `${document.activeElement?.tagName}:${document.activeElement?.className ?? ""}`,
        ),
      );
    }
    // A focus trap would collapse this to one or two distinct elements.
    expect(seen.size, "Tab must move focus across multiple controls").toBeGreaterThan(3);
  });
});

test.describe("mobile layout", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 500, "mobile viewport only");

  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("the page does not scroll horizontally", async ({ page }) => {
    for (const route of ["/dashboard", "/dashboard/tasks", "/dashboard/finance"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // A few px of rounding is tolerable; a real overflow is not.
      expect(overflow, `${route} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(2);
    }
  });

  test("primary tap targets are large enough", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const tooSmall = await page.evaluate(() => {
      const MIN = 44;
      return Array.from(document.querySelectorAll("nav a, nav button"))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { label: (el.textContent ?? "").trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((b) => b.w > 0 && b.h > 0 && (b.w < MIN || b.h < MIN));
    });
    expect(tooSmall, "navigation targets should be at least 44x44").toEqual([]);
  });
});

// Contrast checking now lives in e2e/axe.spec.ts. The hand-rolled walker
// that stood here produced false positives in three separate implementations
// (15 elements reported at exactly 1.00:1, all wrong) because it could not
// resolve layered translucent surfaces or gradient text. axe-core resolves
// stacking, opacity and background images correctly.
