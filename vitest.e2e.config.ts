import { defineConfig } from 'vitest/config';

/**
 * E2E config: boots the real HTTP server per suite. Run serially
 * (single fork) to avoid port/cache contention, with a longer timeout.
 * Emits HTML + JSON + JUnit reports (Cucumber-style browsable output).
 */
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    reporters: ['default', 'json', 'junit', 'html'],
    outputFile: {
      json: './reports/e2e/results.json',
      junit: './reports/e2e/junit.xml',
      html: './reports/e2e/index.html',
    },
  },
});
