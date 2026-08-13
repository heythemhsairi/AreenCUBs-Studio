import { test as base, expect, type Page, type ConsoleMessage } from "@playwright/test";
import { execFileSync } from "node:child_process";

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
  commercial: { username: "commercial", password: "staging-only-not-a-secret" },
  intern: { username: "intern", password: "staging-only-not-a-secret" },
  /** A contact at a client organisation — external, not an employee. */
  client: { username: "client", password: "staging-only-not-a-secret" },
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


/**
 * Restores the one row the portal approval tests write to.
 *
 * The database suite runs every statement inside a transaction that is always
 * rolled back. Browser tests cannot: they drive the real application, and the
 * approval they record is a real UPDATE that survives the test. So the first
 * run passed, the item stopped being pending, and every run after it failed on
 * a button that was correctly no longer there.
 *
 * Restoring the fixture is the honest fix. Asserting "either state is fine"
 * would have made the test unable to detect the approval failing outright.
 */
export function resetPortalApprovalFixture() {
  const container = execFileSync("docker", ["ps", "--format", "{{.Names}}"], {
    encoding: "utf8",
  })
    .split("\n")
    .map((n) => n.trim())
    .find((n) => n.startsWith("supabase_db_"));

  if (!container) throw new Error("no local staging database container");

  execFileSync(
    "docker",
    [
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tAc",
      "update public.content_items set approval_status = 'pending', client_feedback = null " +
        "where id = 'a1000000-0000-4000-8000-000000000001';",
    ],
    { encoding: "utf8" },
  );
}

/**
 * Restores the review fixtures the Phase 7 browser tests write to.
 *
 * Same reasoning as resetPortalApprovalFixture: browser tests drive the real
 * application and their writes survive the test, so anything mutated must be
 * put back or the suite only passes on its first run. This clears the resolve
 * flag on the seeded client comment, removes comments the tests posted
 * (recognisable by their PROBE- prefix), and drops any version uploaded to the
 * Nova asset so the upload test can assert an exact version number.
 */
export function resetReviewFixture() {
  const container = execFileSync("docker", ["ps", "--format", "{{.Names}}"], {
    encoding: "utf8",
  })
    .split("\n")
    .map((n) => n.trim())
    .find((n) => n.startsWith("supabase_db_"));

  if (!container) throw new Error("no local staging database container");

  const statements = [
    "begin;",
    "update public.review_comments set resolved_at = null, resolved_by = null " +
      "where id = 'f3000000-0000-4000-8000-000000000002';",
    "delete from public.review_comments where body like 'PROBE-%';",
    "delete from public.review_versions " +
      "where asset_id = 'f1000000-0000-4000-8000-000000000002' and version_number > 1;",
    // The storage OBJECT row too, not only the version row. The upload uses
    // upsert:false — a version's file is immutable once the client may have
    // seen it — so a leftover object at the same path fails the next run with
    // "The resource already exists".
    //
    // Direct deletes on storage.objects are blocked by the local storage
    // extension's protect_delete() trigger, even for a superuser. Disabling
    // triggers is scoped with SET LOCAL to this transaction and placed AFTER
    // the review-table deletes above, whose ON DELETE CASCADE is itself
    // implemented as system triggers and must stay enabled.
    "set local session_replication_role = replica;",
    "delete from storage.objects where bucket_id = 'review-media' and exists (" +
      "select 1 from public.review_assets ra where ra.title like 'PROBE-%' " +
      "and split_part(storage.objects.name, '/', 2) = ra.id::text);",
    "delete from storage.objects where bucket_id = 'review-media' " +
      "and name like 'c1000000-0000-4000-8000-000000000002/%';",
    "set local session_replication_role = origin;",
    "delete from public.review_assets where title like 'PROBE-%';",
    "update public.review_assets set status = 'in_review' " +
      "where id in ('f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002');",
    "commit;",
  ].join(" ");

  execFileSync(
    "docker",
    ["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", statements],
    { encoding: "utf8" },
  );
}

/** React hydration failures, by the codes React emits in production builds. */
export function hydrationErrors(errors: string[]): string[] {
  return errors.filter((e) =>
    /minified react error #(418|423|425)|hydrat|did not match|text content does not match/i.test(e),
  );
}
