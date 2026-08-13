import { test, expect, login, ACCOUNTS } from "./fixtures";
import type { Page, TestInfo } from "@playwright/test";

/**
 * Design-evidence matrix: every ROLE across its own routes, in BOTH themes, at
 * all three viewports.
 *
 * ── Why this is one test per role and not one per screenshot ─────────────────
 *
 * The first version of this file declared a test per (role × route) and signed
 * in inside `beforeEach`. That is roughly 174 sign-ins per project. Measured
 * twice, it took ~80 minutes and finished 117 failed / 15 passed: past a point
 * the server stopped serving the login form inside the timeout and every
 * remaining test failed in the HOOK rather than on its assertion, which made a
 * cost problem look like an authentication bug.
 *
 * The suite runs with `workers: 1`, so this was never contention between
 * parallel workers — it was 174 sequential full authentications, each with a
 * server action, a redirect and a cookie round-trip.
 *
 * So: one test per role. It signs in ONCE and walks every route it is allowed
 * to reach. Six sign-ins per project instead of 174.
 *
 * ── Failures name the surface ────────────────────────────────────────────────
 *
 * A stop that fails does not abort the walk. Each is caught, recorded with its
 * role, route, theme and viewport, and the test fails at the end with the whole
 * list — one broken route hiding the other sixteen is exactly how the previous
 * run produced 117 indistinguishable failures.
 *
 *   npx playwright test shots
 */

type Stop = {
  name: string;
  path: string;
  /**
   * After photographing the list, follow its first row into the detail page
   * (and on into `edit` / `print` when those links exist).
   *
   * Detail routes are reached by CLICKING rather than by hard-coded UUIDs. The
   * seed owns those ids; a literal here would be a second copy of the seed that
   * silently rots. Following the list also proves the list actually links
   * somewhere, which a hard-coded URL does not.
   */
  drill?: boolean;
};

/** Routes each role can actually reach. A redirect photographs nothing. */
const BY_ROLE: Record<keyof typeof ACCOUNTS, Stop[]> = {
  admin: [
    { name: "dashboard", path: "/dashboard" },
    { name: "tasks", path: "/dashboard/tasks", drill: true },
    { name: "tasks-tags", path: "/dashboard/tasks/tags" },
    { name: "tasks-templates", path: "/dashboard/tasks/templates" },
    { name: "clients", path: "/dashboard/clients", drill: true },
    { name: "projects", path: "/dashboard/projects", drill: true },
    { name: "finance", path: "/dashboard/finance" },
    { name: "devis", path: "/dashboard/devis", drill: true },
    { name: "factures", path: "/dashboard/factures", drill: true },
    { name: "content", path: "/dashboard/content" },
    { name: "content-publishing", path: "/dashboard/content/publishing" },
    { name: "content-calendar", path: "/dashboard/content/calendar" },
    { name: "content-reports", path: "/dashboard/content/reports" },
    { name: "calendar", path: "/dashboard/calendar" },
    { name: "review", path: "/dashboard/review", drill: true },
    { name: "reports", path: "/dashboard/reports" },
    { name: "audit", path: "/dashboard/audit" },
    { name: "team", path: "/dashboard/team", drill: true },
    { name: "team-planning", path: "/dashboard/team/planning" },
    { name: "team-workload", path: "/dashboard/team/workload" },
    { name: "services", path: "/dashboard/services", drill: true },
    { name: "social-media", path: "/dashboard/social-media" },
    { name: "admin-tasks", path: "/dashboard/admin-tasks", drill: true },
    { name: "settings", path: "/dashboard/settings" },
    { name: "profile", path: "/dashboard/profile" },
  ],
  commercial: [
    { name: "dashboard", path: "/dashboard" },
    { name: "clients", path: "/dashboard/clients", drill: true },
    { name: "devis", path: "/dashboard/devis", drill: true },
    { name: "review", path: "/dashboard/review" },
    { name: "profile", path: "/dashboard/profile" },
  ],
  intern: [
    { name: "dashboard", path: "/dashboard" },
    { name: "tasks", path: "/dashboard/tasks", drill: true },
    { name: "profile", path: "/dashboard/profile" },
  ],
  worker: [
    { name: "dashboard", path: "/dashboard" },
    { name: "tasks", path: "/dashboard/tasks", drill: true },
    { name: "clients", path: "/dashboard/clients" },
    { name: "profile", path: "/dashboard/profile" },
  ],
  freelancer: [
    { name: "dashboard", path: "/dashboard" },
    { name: "tasks", path: "/dashboard/tasks", drill: true },
    { name: "profile", path: "/dashboard/profile" },
  ],
  client: [{ name: "portal", path: "/portal", drill: true }],
  // The profile-less account never reaches an authenticated surface; it is
  // photographed by the unauthenticated block below instead.
  orphan: [],
};

const THEMES = ["dark", "light"] as const;
type Theme = (typeof THEMES)[number];

/** Where a stop failed, in enough detail to act on without re-running. */
type Failure = { role: string; route: string; theme: string; viewport: string; reason: string };

/**
 * Waits for a page to be photographable rather than merely loaded.
 *
 * `networkidle` alone is not a readiness signal for this app: an RSC payload
 * can settle while the client is still swapping a skeleton for a table, and the
 * shutter then catches a half-painted screen. So readiness is asserted against
 * what is actually on the page — the main landmark exists, no skeleton is left,
 * and the webfonts have loaded (Manrope arriving late reflows every heading).
 *
 * Every wait is bounded and the soft ones swallow their timeout. A route that
 * legitimately never reaches network idle should still be photographed; the
 * hard requirement is only that `main` appeared.
 */
async function ready(page: Page): Promise<{ outsideShell: string | null }> {
  // `main` comes from the dashboard and portal layouts. A page that has none is
  // rendering OUTSIDE the app shell — Next's own unstyled 404, or an error
  // boundary mounted above the layout. That is a real finding, not a harness
  // failure, so it is reported by name and still photographed; only a page that
  // painted nothing at all is treated as broken.
  const hasMain = await page
    .waitForSelector("main", { state: "visible", timeout: 12_000 })
    .then(() => true)
    .catch(() => false);

  let outsideShell: string | null = null;
  if (!hasMain) {
    const seen = await page.evaluate(() => ({
      url: location.pathname,
      title: document.title,
      text: (document.body?.innerText ?? "").trim().slice(0, 120).replace(/\s+/g, " "),
    }));
    if (!seen.text) throw new Error(`blank page at ${seen.url} (no main, no text)`);
    outsideShell = `${seen.url} — "${seen.title}" — ${seen.text}`;
  }

  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page
    .waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, undefined, {
      timeout: 10_000,
    })
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  return { outsideShell };
}

/** Records a page that rendered outside the app shell, once per surface. */
function noteShellless(role: string, name: string, detail: string | null) {
  if (!detail) return;
  const line = `${role} · ${name} · ${detail}`;
  test.info().annotations.push({ type: "outside-app-shell", description: line });
  // Also to stdout: annotations are not printed by the list reporter, and this
  // is a finding the review is supposed to act on, not a footnote in a report.
  console.log(`[shell] outside the app shell — ${line}`);
}

/**
 * Did we land where we asked?
 *
 * A role that may not reach a route is redirected, and the shot was being
 * saved under the name of the route that was REQUESTED. The commercial sheet
 * had a cell labelled `devis-print` that was a photograph of the commercial
 * dashboard — evidence of a working guard, filed as evidence of a print view.
 *
 * A redirect is worth recording (it demonstrates the guard) but it is not
 * design evidence for the route that was asked for, so it is annotated and the
 * shutter is not fired.
 */
function landedElsewhere(page: Page, requested: string): string | null {
  const actual = new URL(page.url()).pathname;
  if (actual === requested || actual === requested.replace(/\/$/, "")) return null;
  return actual;
}

function noteRedirect(role: string, requested: string, landed: string) {
  const line = `${role} · ${requested} → ${landed}`;
  test.info().annotations.push({ type: "redirected", description: line });
  console.log(`[redirect] not photographed — ${line}`);
}

/** Applies the theme the same way the app does, then lets the transition land. */
async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("light", t === "light");
    try {
      localStorage.setItem("areencubs.theme", t);
    } catch {
      /* storage may be unavailable; the class is what paints */
    }
  }, theme);
  // Colour transitions on surfaces are 150ms; charts re-read tokens on the
  // class mutation and re-render on the next frame.
  await page.waitForTimeout(300);
}

/**
 * Releases the app's inner scroll container so `fullPage` means the full page.
 *
 * The dashboard shell is `h-screen` with `<main className="flex-1
 * overflow-y-auto">`: the DOCUMENT never scrolls, `main` does. Playwright's
 * fullPage capture measures the document, so every screenshot in the first
 * complete run came back exactly 1280x720 — the fold, not the page. Six
 * hundred screenshots of the top of each route is not evidence of a layout.
 *
 * So the height and overflow constraints are lifted from `main` and every
 * ancestor of it for the duration of the shot, and restored afterwards.
 *
 * Only the VERTICAL axis is released. The first version used `overflow:
 * visible`, which also switched off horizontal clipping, and the matrix then
 * captured /dashboard at 484px on a 390px viewport — reported and chased as a
 * responsive defect until `overflow.spec.ts` proved the running page does not
 * overflow at all. The width was manufactured by the capture. `overflow-x:
 * clip` keeps the horizontal clipping intact while leaving the vertical axis
 * `visible`; `hidden` would not work, because a `visible` axis paired with a
 * `hidden` one computes back to `auto` and re-creates the scroll container.
 *
 * Horizontal overflow is therefore NOT this file's job. `overflow.spec.ts`
 * asserts it directly, at real viewport widths, and names the offending
 * elements.
 *
 * Known artefact, not worth correcting: the rail is `h-screen` and stays that
 * height, so on a tall page it occupies only the top band of the image. The
 * rail is reviewed on its own at the fold.
 */
const RELEASE_SCROLL = `
  html, body {
    height: auto !important;
    overflow-x: clip !important;
    overflow-y: visible !important;
  }
  body *:has(main), main {
    height: auto !important;
    max-height: none !important;
    overflow-x: clip !important;
    overflow-y: visible !important;
  }
`;

async function withFullPage<T>(page: Page, fn: () => Promise<T>): Promise<T> {
  const id = "shot-fullpage";
  await page.evaluate(
    ([css, styleId]) => {
      const el = document.createElement("style");
      el.id = styleId;
      el.textContent = css;
      document.head.appendChild(el);
    },
    [RELEASE_SCROLL, id] as const,
  );
  await page.waitForTimeout(150); // reflow
  try {
    return await fn();
  } finally {
    await page.evaluate((styleId) => document.getElementById(styleId)?.remove(), id);
  }
}

/** Photographs the current page in both themes. */
async function shoot(page: Page, info: TestInfo, role: string, name: string): Promise<void> {
  return withFullPage(page, () => shootThemes(page, info, role, name));
}

async function shootThemes(page: Page, info: TestInfo, role: string, name: string): Promise<void> {
  for (const theme of THEMES) {
    await setTheme(page, theme);
    await page.screenshot({
      path: `e2e/.screens/${info.project.name}/${theme}/${role}-${name}.png`,
      fullPage: true,
    });
  }
  // Leave the page in the default theme so the next navigation starts clean.
  await setTheme(page, "dark");
}

/**
 * The first row link out of a list page, excluding the "new" affordance.
 *
 * Returns null when the list is legitimately empty for this role — an empty
 * list is a real state worth photographing, not a failure.
 */
async function firstRowHref(page: Page, base: string): Promise<string | null> {
  return page.evaluate((b) => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(`main a[href^="${b}/"]`));
    const hit = links.find((a) => {
      const href = a.getAttribute("href") ?? "";
      return !href.endsWith("/new") && href !== b;
    });
    return hit ? hit.getAttribute("href") : null;
  }, base);
}

/** A link on the current page whose href ends with the given suffix. */
async function hrefEndingWith(page: Page, suffix: string): Promise<string | null> {
  return page.evaluate((s) => {
    const a = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).find((el) =>
      (el.getAttribute("href") ?? "").endsWith(s),
    );
    return a ? a.getAttribute("href") : null;
  }, suffix);
}

for (const role of Object.keys(BY_ROLE) as (keyof typeof ACCOUNTS)[]) {
  const stops = BY_ROLE[role];
  if (stops.length === 0) continue;

  test(`design evidence — ${role}`, async ({ page }, info) => {
    // One budget for the whole walk. Each stop is a navigation, two full-page
    // screenshots and the readiness waits above; ~20s is generous per stop and
    // the per-action timeouts inside `ready` still bound every individual wait,
    // so a hang is reported as a hung ROUTE rather than as a hung suite.
    test.setTimeout(60_000 + stops.length * 20_000);

    const viewport = `${info.project.name} ${page.viewportSize()?.width}x${page.viewportSize()?.height}`;
    const failures: Failure[] = [];

    // The single sign-in this whole matrix costs.
    await login(page, role);

    const record = (route: string, reason: string) =>
      failures.push({ role, route, theme: "both", viewport, reason });

    for (const stop of stops) {
      try {
        await page.goto(stop.path, { waitUntil: "domcontentloaded", timeout: 20_000 });
        noteShellless(role, stop.name, (await ready(page)).outsideShell);
        const moved = landedElsewhere(page, stop.path);
        if (moved) {
          noteRedirect(role, stop.path, moved);
          continue;
        }
        await shoot(page, info, role, stop.name);
      } catch (err) {
        record(stop.path, (err as Error).message.split("\n")[0]);
        continue;
      }

      if (!stop.drill) continue;

      // ── list → detail → (edit | print) ─────────────────────────────────────
      try {
        const detail = await firstRowHref(page, stop.path);
        if (!detail) {
          // Not a failure. Recorded so a silently empty list cannot be mistaken
          // for coverage when the contact sheet is reviewed.
          test.info().annotations.push({
            type: "empty-list",
            description: `${role} ${stop.path} — no row to drill into`,
          });
          continue;
        }

        await page.goto(detail, { waitUntil: "domcontentloaded", timeout: 20_000 });
        noteShellless(role, `${stop.name}-detail`, (await ready(page)).outsideShell);
        if (landedElsewhere(page, detail)) {
          noteRedirect(role, detail, new URL(page.url()).pathname);
          continue;
        }
        await shoot(page, info, role, `${stop.name}-detail`);

        for (const suffix of ["/edit", "/print"]) {
          const onward = await hrefEndingWith(page, suffix);
          if (!onward) continue;
          await page.goto(onward, { waitUntil: "domcontentloaded", timeout: 20_000 });
          noteShellless(role, `${stop.name}${suffix}`, (await ready(page)).outsideShell);
          if (landedElsewhere(page, onward)) {
            noteRedirect(role, onward, new URL(page.url()).pathname);
            continue;
          }
          await shoot(page, info, role, `${stop.name}${suffix.replace("/", "-")}`);
          await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
          await ready(page).catch(() => {});
        }
      } catch (err) {
        record(`${stop.path} (drill)`, (err as Error).message.split("\n")[0]);
      }
    }

    expect(
      failures,
      `screenshot stops failed:\n${failures
        .map((f) => `  ${f.viewport} · ${f.role} · ${f.route} · ${f.theme} — ${f.reason}`)
        .join("\n")}`,
    ).toEqual([]);
  });
}

test("design evidence — unauthenticated and error states", async ({ page }, info) => {
  test.setTimeout(180_000);
  const viewport = `${info.project.name} ${page.viewportSize()?.width}x${page.viewportSize()?.height}`;
  const failures: Failure[] = [];

  const capture = async (name: string, go: () => Promise<void>) => {
    try {
      await go();
      noteShellless("public", name, (await ready(page)).outsideShell);
      await shoot(page, info, "public", name);
    } catch (err) {
      failures.push({
        role: "public",
        route: name,
        theme: "both",
        viewport,
        reason: (err as Error).message.split("\n")[0],
      });
    }
  };

  await capture("login", async () => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 20_000 });
  });

  // The error state of the form, which is a different layout: an alert appears
  // above the submit button and the card grows.
  await capture("login-error", async () => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.fill('input[name="username"]', "nobody-at-all");
    await page.fill('input[name="password"]', "wrong-password");
    await page.click('button[type="submit"]');
    await page.waitForSelector('[role="alert"]', { timeout: 15_000 });
  });

  // Authenticated FIRST, deliberately. The previous version ran this straight
  // after the failed-login capture, so the session was gone, middleware bounced
  // /dashboard/* to /login, and the file named "not-found" was a photograph of
  // the login form. It had a `main`, so nothing failed and the mislabelled
  // evidence would have been reviewed as if it were the 404.
  await login(page, "admin");

  await capture("not-found", async () => {
    await page.goto("/dashboard/this-route-does-not-exist", {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
  });

  // A malformed dynamic segment makes the server component's own data load
  // throw, which is what renders the route-group error boundary. Triggering it
  // through a real request keeps the application unmodified — an exported
  // "throw on a query param" hook would be test-only code in production.
  await capture("dashboard-error", async () => {
    await page.goto("/dashboard/clients/not-a-uuid", {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
  });

  await capture("portal-error", async () => {
    await page.context().clearCookies();
    await login(page, "client");
    await page.goto("/portal/review/not-a-uuid", {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
  });

  await capture("account-unavailable", async () => {
    await page.context().clearCookies();
    await login(page, "orphan");
  });

  expect(
    failures,
    `screenshot stops failed:\n${failures
      .map((f) => `  ${f.viewport} · ${f.role} · ${f.route} · ${f.theme} — ${f.reason}`)
      .join("\n")}`,
  ).toEqual([]);
});
