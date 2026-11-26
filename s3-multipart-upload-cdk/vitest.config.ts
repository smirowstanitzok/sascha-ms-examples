// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // synthesizing the stack bundles the Lambda code with esbuild, which takes a moment
    testTimeout: 60_000,
  },
});
