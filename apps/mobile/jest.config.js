const expoPreset = require('jest-expo/jest-preset');

// FlashList 2.3 ships ES modules, which jest-expo's transform allow-list does not cover. Its first
// pattern is a negative lookahead over package names, so FlashList joins that list.
const [allowList, ...otherIgnores] = expoPreset.transformIgnorePatterns;
const withFlashList = allowList.replace('(?!(', '(?!(@shopify/flash-list|');
if (withFlashList === allowList) {
  throw new Error("jest-expo's transformIgnorePatterns changed shape; update jest.config.js.");
}

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [withFlashList, ...otherIgnores],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Reanimated's resolver (its runtime setup resolves to the web build) over React Native's.
  resolver: '<rootDir>/jest.resolver.js',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // react-native-svg-transformer is Metro-only; tests get a View stand-in.
    '\\.svg$': '<rootDir>/__mocks__/svgMock.tsx',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  // Every screen suite runs a full RN render pipeline on real timers; at jest's default
  // cores-1 parallelism the 40-suite run oversubscribes a laptop and time-sensitive waits
  // start missing their windows (a different suite flakes each run). Half the cores keeps
  // the full run deterministic; single suites are unaffected.
  maxWorkers: '50%',
};
