/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Reanimated 4's jest mock needs the worklets resolver to pick the JS (non-.native) entry.
  resolver: 'react-native-worklets/jest/resolver',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // react-native-svg-transformer is Metro-only; tests get a View stand-in.
    '\\.svg$': '<rootDir>/__mocks__/svgMock.tsx',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  // jest-expo's built-in transformIgnorePatterns already allow-list .pnpm, react-native, expo, etc.
  // Every screen suite runs a full RN render pipeline on real timers; at jest's default
  // cores-1 parallelism the 40-suite run oversubscribes a laptop and time-sensitive waits
  // start missing their windows (a different suite flakes each run). Half the cores keeps
  // the full run deterministic; single suites are unaffected.
  maxWorkers: '50%',
};
