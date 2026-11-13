// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // Already the default in Vitest 5, spelled out here for clarity
    clearMocks: true,
    coverage: { provider: "v8", include: ["src/**/*.ts"] },
  },
});
