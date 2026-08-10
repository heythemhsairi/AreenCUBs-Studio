import { test as base, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Shared fixtures.
 *
 * Every test collects console errors and failed network requests. A page that
 * renders correctly but logs a hydration mismatch is still broken, and that is
 * precisely the class of defect this phase exists to catch — so the noise is
 * captured rather than ignored.
 */

export type PageDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  /** Console errors excluding known-benign noise. */
  significantErrors(): string[];
};

/**
 * Messages that are not defects in this environment.
 *
 * Kept deliberately short and specific. A broad filter here would quietly
 * swallow the very errors the suite is meant to surface.
 */
const BENIGN = [
  /favicon/i,
  /Download the React DevTools/i,
  // Next.js dev-only HMR chatter; harmless if the server is ever run in dev.
  /\[Fast Refresh\]/i,
];

function isBenign(text: string): boolean {
  return BENIGN.some((re) => re.test(text));
}

export const test = base.extend<{ diagnostics: PageDiagnostics }>({
  diagnostics: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("requestfailed", (req) => {
      const failure = req.failure()?.errorText ?? "unknown";
      // Navigations aborted by a redirect are normal, not failures.
      if (/ERR_ABORTED/i.test(failure)) return;
      failedRequests.push(`${req.method()} ${req.url()} — ${failure}`);
    });
    page.on("response", (res: import("@playwright/test").Response) => {
      if (res.status() >= 500) failedRequests.push(`${res.status()} ${res.url()}`);
    });

    const diagnostics: PageDiagnostics = {
      consoleErrors,
      pageErrors,
      failedRequests,
      significantErrors: () => [...consoleErrors, ...pageErrors].filter((e) => !isBenign(e)),
    };

    await use(diagnostics);
  },
});

export { expect };

/** Fabricated staging accounts. Password is a local-only fixture. */
export const ACCOUNTS = {
  admin: { username: "admin", password: "staging-only-not-a-secret" },
  worker: { username: "worker", password: "staging-only-not-a-secret" },
  freelancer: { username: "freelancer", password: "staging-only-not-a-secret" },
  /** Authenticated but has NO profiles row — must be denied. */
  orphan: { username: "orphan", password: "staging-only-not-a-secret" },
};

/**
 * Signs in and does not return until the session is actually usable.
 *
 * The previous implementation raced: `Promise.all([waitForLoadState('networkidle'),
 * click])` could resolve before the server action's redirect and Set-Cookie had
 * landed, so the next `goto` was made without a session and bounced to /login.
 * It passed on the desktop project and failed on tablet and mobile purely on
 * timing — the classic shape of a flaky auth helper.
 *
 * Waiting for the URL to LEAVE /login ties the helper to the observable
 * outcome instead of to network quiescence.
 */
export async function login(page: Page, who: keyof typeof ACCOUNTS) {
  const { username, password } = ACCOUNTS[who];
  await page.goto("/login");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Valid accounts land on /dashboard; the profile-less account is redirected
  // to /account-unavailable. Either is a completed sign-in.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

/** React hydration failures, by the codes React emits in production builds. */
export function hydrationErrors(errors: string[]): string[] {
  return errors.filter((e) =>
    /minified react error #(418|423|425)|hydrat|did not match|text content does not match/i.test(e),
  );
}
