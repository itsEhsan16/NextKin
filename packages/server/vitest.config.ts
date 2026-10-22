import { defineConfig } from 'vitest/config';

/**
 * Two projects (ImBackendImplementationPlan P1-11). `unit` runs without Docker and is what the
 * root `pnpm test` gate runs. `integration` needs the compose stack (`pnpm stack:up`) and runs as
 * `pnpm test:integration` and in backend CI.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
          exclude: ['test/**/*.int.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/**/*.int.test.ts'],
          setupFiles: ['test/integration/setup.ts'],
          // One stack, shared state: run files one after another.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        // P13-02: drills restart or kill parts of the stack, so they never run with the suite above.
        test: {
          name: 'drills',
          include: ['test/drills/**/*.drill.ts'],
          setupFiles: ['test/integration/setup.ts'],
          fileParallelism: false,
          testTimeout: 180_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
