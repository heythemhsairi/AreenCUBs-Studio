import { defineConfig, devices } from "@playwright/test";

/**
 * Browser verification against the isolated local stack.
 *
 * ── The timezone split is the point ──────────────────────────────────────────
 * The server runs with TZ=UTC (see `webServer.env`) to model Vercel, while the
 * browser context runs in Africa/Tunis. That asymmetry is exactly what
 * produced React hydration error #418 on the Publishing page, so the suite
 * reproduces the production condition rather than a convenient one.
 *
 * Everything points at 127.0.0.1. Nothing here can reach a hosted project.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://127.0.0.1:3000",
    // The agency's real browser conditions.
    timezoneId: "Africa/Tunis",
    locale: "fr-FR",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],

  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
    // Server-side UTC. If this ever matches the browser timezone, the
    // hydration tests stop testing anything.
    env: { TZ: "UTC" },
  },
});
