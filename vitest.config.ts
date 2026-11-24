import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Excel and golden tests are slow on busy runners; the 5s default flakes.
    testTimeout: 30_000,
    include: ["packages/*/test/**/*.test.ts", "scripts/**/*.test.ts", "apps/web/test/**/*.test.ts"],
  },
});
