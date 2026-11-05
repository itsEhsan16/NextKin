import { createAuthClient } from '@nextkin/shared/auth';
import {
  browserUploader,
  configureRepos,
  createHttpClient,
  parseDataSources,
} from '@nextkin/shared/repos';

import { browserStorageUrl } from './storageUrl';

/**
 * Which repositories talk to the backend (ImBackendImplementationPlan P5-02, P5-07).
 *
 * `NEXT_PUBLIC_DATA_SOURCE` is `mock` (or unset), `http` for every repository the backend serves,
 * or a list such as `user,profile`. Unset, nothing changes: the app runs on the mock, as it always
 * has. `NEXT_PUBLIC_API_BASE_URL` is empty for the same-origin API (the default).
 */
export const DATA_SOURCES = parseDataSources(process.env.NEXT_PUBLIC_DATA_SOURCE);
export const USES_BACKEND = Object.keys(DATA_SOURCES).length > 0;

/** Where a lost session goes: the designed sign-in screen (toreview §133.1 item 5). */
export const SIGN_IN = '/sign-in';

const goToSignIn = () => {
  if (typeof window === 'undefined') return;
  // Outside React (the HTTP client's 401 hook), and a full load on purpose: it drops every cached
  // query of the session that just ended.
  // Staff whose session lapses go back to the staff sign-in (Figma 410:1605), not the user app's.
  const target = window.location.pathname.startsWith('/admin') ? '/admin/sign-in' : SIGN_IN;
  if (window.location.pathname !== target) window.location.assign(target);
};

export const http = createHttpClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
  client: 'web',
  onSignedOut: goToSignIn,
});

export const auth = createAuthClient({ http });

/** Runs once at module scope, before the first render, like `configureMockData`. */
export function configureDataSource(): void {
  if (!USES_BACKEND) return;
  configureRepos({
    sources: DATA_SOURCES,
    http,
    // A production build refuses an HTTP repository that still answers some methods from the mock.
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    // Files go straight to storage from the browser: the JdFile's uri is a blob: URL (P7-02).
    // A page opened away from localhost reaches local storage through its own origin (§131.7).
    uploader: (target, file) =>
      browserUploader({ ...target, url: browserStorageUrl(target.url) }, file),
    user: {
      navigate: (url) => window.location.assign(url),
      linkReturnTo: '/settings',
      // P12-06: a finished hosted checkout comes back to Settings (the plan page is coming soon).
      checkoutReturnPath: '/settings',
    },
  });
}
