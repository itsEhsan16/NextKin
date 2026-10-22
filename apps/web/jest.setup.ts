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
