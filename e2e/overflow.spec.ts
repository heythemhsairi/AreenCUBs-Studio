import { test, expect, login, ACCOUNTS } from "./fixtures";

/**
 * Nothing may overflow the viewport horizontally.
 *
 * A phone-width page that scrolls sideways is the most common and least
 * excusable responsive defect: every vertical swipe drifts, tap targets move
 * under the finger, and the right-hand edge of tables and cards is simply
 * unreachable. It is also invisible to every other check in this suite —
 * axe does not measure layout, and a screenshot only shows it if someone
 * notices the image is wider than the phone.
 *
 * That is exactly how it was found: the design-evidence matrix captured
 * /dashboard at 484px on a 390px viewport, a 94px overflow that had been
 * shipping unremarked.
 *
 * The assertion reports the offending ELEMENTS, not just the page width,
 * because "the document is 484px wide" is not actionable on a page with a
 * thousand nodes.
 */

const ROUTES_BY_ROLE: { role: keyof typeof ACCOUNTS; routes: string[] }[] = [
  {
    role: "admin",
    routes: [
      "/dashboard",
      "/dashboard/tasks",
      "/dashboard/clients",
      "/dashboard/projects",
      "/dashboard/finance",
      "/dashboard/devis",
      "/dashboard/factures",
      "/dashboard/content",
      "/dashboard/content/publishing",
      "/dashboard/calendar",
      "/dashboard/review",
      "/dashboard/reports",
      "/dashboard/team",
      "/dashboard/services",
      "/dashboard/settings",
      "/dashboard/profile",
    ],
  },
  { role: "client", routes: ["/portal"] },
];

/**
 * Elements whose right edge extends past the viewport.
 *
 * Deliberately ignores elements inside a container that opted into horizontal
 * scrolling — a wide data table in an `overflow-x-auto` wrapper is a designed
 * behaviour, not a defect. What is reported is content that pushes the PAGE
 * itself sideways.
 */
async function overflowingElements(page: import("@playwright/test").Page, width: number) {
  return page.evaluate((vw) => {
    const scrollsHorizontally = (el: Element) => {
      const o = getComputedStyle(el);
      return /(auto|scroll)/.test(o.overflowX);
    };
    const out: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return out.length ? out : out;
      if (rect.right <= vw + 1) continue;

      // Skip anything living inside a deliberate horizontal scroller.
      let inScroller = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (scrollsHorizontally(p)) {
          inScroller = true;
          break;
        }
      }
      if (inScroller) continue;

      // Report the outermost offenders only: if a parent already overflows by
      // the same amount, its children are symptoms, not causes.
      const parent = el.parentElement;
      if (parent && parent !== document.body && parent.getBoundingClientRect().right > vw + 1) {
        continue;
      }

      const id = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${(el.className || "")
        .toString()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4)
        .join(".")}`;
      out.push(`${id} → right edge ${Math.round(rect.right)}px`);
      if (out.length >= 8) break;
    }
    return out;
  }, width);
}

for (const { role, routes } of ROUTES_BY_ROLE) {
  test(`no horizontal overflow — ${role}`, async ({ page }, info) => {
    test.setTimeout(30_000 + routes.length * 15_000);

    const width = page.viewportSize()?.width ?? 0;
    await login(page, role);

    const failures: string[] = [];

    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForSelector("main", { state: "visible", timeout: 15_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      if (scrollWidth <= width + 1) continue;

      const offenders = await overflowingElements(page, width);
      failures.push(
        `${info.project.name} ${width}px · ${role} · ${route} — document ${scrollWidth}px\n` +
          offenders.map((o) => `      ${o}`).join("\n"),
      );
    }

    expect(failures, `horizontal overflow:\n${failures.join("\n")}`).toEqual([]);
  });
}
