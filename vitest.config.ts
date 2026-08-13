import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.mjs"],
    // Deliberately hostile timezone. Vercel's Node runtime reports UTC while
    // the agency's browsers run Africa/Tunis (UTC+1). Pinning TZ=UTC here means
    // every date assertion in the suite is written from the SERVER's point of
    // view — so any formatter that silently follows the ambient timezone fails
    // these tests instead of failing in production as a hydration mismatch.
    env: { TZ: "UTC" },
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The marker package throws outside a Server Component, which is right
      // in the app and wrong in a node test runner.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
