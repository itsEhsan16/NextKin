/**
 * @nextkin/shared — the data layer both clients build on.
 *
 * Domain models mirroring the V2 entities (Section 10), the mock fixtures and repositories that
 * stand in for the API until it exists, and the TanStack Query hooks screens actually call.
 * Nothing here imports React Native, Expo or Next.js: swapping `repos` for an /api/v1 client
 * (Section 11) must not change a single hook signature on either platform.
 *
 * Prefer the subpath entries — `@nextkin/shared/models`, `/mock`, `/repos`, `/queries` — so the
 * lint fence that keeps fixtures out of screens keeps working.
 */
export * from './models';
export * from './repos';
export * from './queries';
