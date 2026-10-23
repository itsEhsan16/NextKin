const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // The orb draws on a canvas, which jsdom has not got (toreview §132.9).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^thinking-orbs$': '<rootDir>/__mocks__/thinkingOrbs.tsx',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  // `next build` copies the workspace into .next/standalone, which gives every package.json a
  // twin and trips jest-haste-map's name collision check.
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  // Half the cores, not Jest's cores − 1: on the 24-core reference machine, 23 jsdom workers next to
  // the Docker stack pushed the heaviest screen tests (2–3 s alone) past the 5 s timeout
  // (`toreview.md` §105.21). The timeout stays at 5 s so a genuinely slow test still fails.
  maxWorkers: '50%',
};

module.exports = createJestConfig(config);
