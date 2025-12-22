import { defineConfig } from 'vitest/config';

// Integration tests are tagged by filename pattern `*.integration.test.ts`.
// They expect DATABASE_URL and REDIS_URL to be provided (CI and scripts/ci-local.ps1 set them).
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    passWithNoTests: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: 'default',
    environment: 'node',
    sequence: {
      concurrent: false,
    },
  },
});
