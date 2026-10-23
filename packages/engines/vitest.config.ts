import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // The engines gate (P8-09): §16.2 asks for near-total branch coverage on the timeline engine
    // and the same treatment for the rubric's deterministic parts.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      reporter: ['text-summary'],
      thresholds: {
        lines: 95,
        branches: 85,
        'src/timeline.ts': { lines: 100, branches: 95 },
        'src/plausibility.ts': { lines: 98, branches: 90 },
        'src/targetPlan.ts': { lines: 98, branches: 90 },
        'src/requirements.ts': { lines: 98, branches: 90 },
        'src/rubric.ts': { lines: 98, branches: 90 },
        'src/normalizer.ts': { lines: 98, branches: 90 },
      },
    },
  },
});
