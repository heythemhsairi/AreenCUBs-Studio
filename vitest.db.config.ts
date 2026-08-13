import { defineConfig } from "vitest/config";

/**
 * Database integration tests.
 *
 * Kept in a SEPARATE config from the default suite on purpose: the default
 * suite must stay hermetic and runnable in CI with no Docker, while these
 * require a running local staging stack.
 *
 *   npm run db:start && npm run db:reset && npm run test:db
 *
 * These never touch a hosted project — every query goes through `docker exec`
 * against the local supabase_db container, so no key or connection string is
 * involved and none can leak.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/db/**/*.dbtest.mjs"],
    env: { TZ: "UTC" },
    // psql round-trips through docker exec are not fast; run them serially so
    // failures are readable and the database sees a predictable sequence.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
