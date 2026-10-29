import { defineConfig } from 'vitest/config';

/** Default config: unit tests only (fast), with report output. */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    reporters: ['default', 'json', 'junit', 'html'],
    outputFile: {
      json: './reports/unit/results.json',
      junit: './reports/unit/junit.xml',
      html: './reports/unit/index.html',
    },
  },
});
