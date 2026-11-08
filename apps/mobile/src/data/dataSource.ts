import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { createAuthClient } from '@nextkin/shared/auth';
import { configureRepos, createHttpClient, parseDataSources } from '@nextkin/shared/repos';

import { CLERK_PUBLISHABLE_KEY, clerkTokens } from './clerkSession';
import { secureTokens } from './secureTokens';
import { expoUploader } from './uploader';

/**
 * Which repositories talk to the backend (ImBackendImplementationPlan P5-02, P5-08).
 *
 * `EXPO_PUBLIC_DATA_SOURCE` is `mock` (or unset), `http` for every repository the backend serves,
 * or a list such as `user,profile`; `EXPO_PUBLIC_API_BASE_URL` is the API on your machine as the
 * phone sees it, e.g. http://192.168.1.20:3000 (Next must listen on 0.0.0.0). Unset, the app runs
 * on the mock exactly as before.
 */
export const DATA_SOURCES = parseDataSources(process.env.EXPO_PUBLIC_DATA_SOURCE);
export const USES_BACKEND = Object.keys(DATA_SOURCES).length > 0;
/** Sign-in through Clerk (toreview §173): the backend with a Clerk key set. */
export const USES_CLERK = USES_BACKEND && CLERK_PUBLISHABLE_KEY !== '';

let signedOutHandler: () => void = () => {};

/** The session feature registers what "signed out for good" means on this device. */
export function onSignedOut(handler: () => void): void {
  signedOutHandler = handler;
}

export const http = createHttpClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  client: 'mobile',
  platform: Platform.OS,
  // On Clerk the bearer is a fresh Clerk token, and a 401 reopens the server session (lazy: `auth`
  // is made just below).
  tokens: USES_CLERK ? clerkTokens((token) => auth.clerkExchange(token)) : secureTokens,
  // The store version from app.config: the server's floor answers older builds with 426.
  clientVersion: Constants.expoConfig?.version,
  onSignedOut: () => signedOutHandler(),
});

export const auth = createAuthClient({ http });

/** Runs once at module scope, before the first render. */
export function configureDataSource(): void {
  if (!USES_BACKEND) return;
  configureRepos({
    sources: DATA_SOURCES,
    http,
    environment: __DEV__ ? 'development' : 'production',
    // Picked files go straight to storage from their file:// URI (P7-02).
    uploader: expoUploader,
  });
}
