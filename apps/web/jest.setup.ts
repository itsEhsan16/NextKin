import '@testing-library/jest-dom';

import { configureMockPlatform } from '@nextkin/shared/mock';

// The app seeds the mock layer with the web boards' jobs and applications (`src/lib/mockMode.ts`),
// so every suite does too, before anything reads the store.
configureMockPlatform('web');

// jsdom implements neither, and both are load-bearing: the sidebar reads a media query to decide
// whether it starts collapsed, and the score ring and progress meter animate on intersection.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Nor blob URLs: the upload panels hand the HTTP repositories a `blob:` URL to the picked file.
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: (blob: Blob) => `blob:test/${blob.size}`,
});
Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: () => {} });

// The double-click guard (§196) holds further navigation for one route change. A test clicks one
// control after another in the same millisecond, each meaning a separate visit, so it is off here;
// __tests__/navigation/guardedRouter.test.ts runs it with its real window.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded lazily, per test.
  const { navigationGate, resetNavigationGuard } = require('@/navigation/guardedRouter');
  navigationGate.windowMs = 0;
  resetNavigationGuard();
});
