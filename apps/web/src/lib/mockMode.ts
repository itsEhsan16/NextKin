import { configureMockMode as configure, configureMockPlatform } from '@nextkin/shared/mock';

import { storage } from './storage';

/**
 * Seeds the shared mock layer with the web boards' jobs and applications instead of mobile's
 * (`packages/shared/src/mock/platform.ts`). Unlike the mode switch below this is not dev-only and
 * runs during the server render too: it decides what data the app has, and until the API lands
 * the mock layer is all there is.
 */
export function configureMockData(): void {
  configureMockPlatform('web');
}

/**
 * Hands the shared mock-mode store somewhere to persist. Only in development — a production
 * build always runs "normal", the same rule `apps/mobile` applies with `__DEV__`.
 *
 * Guarded on `window` because this runs during the server render too, where there is no
 * `localStorage` and nothing to restore.
 */
export function configureMockMode(): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window === 'undefined') return;
  configure(storage);
}
