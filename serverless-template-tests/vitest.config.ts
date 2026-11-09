// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/package-stages.ts'],
    include: ['test/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
