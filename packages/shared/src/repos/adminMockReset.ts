/**
 * The admin areas keep their session changes (a suspended user, a staged prompt) in their own mock
 * repositories. Each registers how to put its fixtures back, and `resetMockRepos()` runs them all,
 * so tests and the dev mode switch start clean.
 */
const resets = new Set<() => void>();

export function onAdminMockReset(reset: () => void): void {
  resets.add(reset);
}

export function resetAdminMocks(): void {
  for (const reset of resets) reset();
}
