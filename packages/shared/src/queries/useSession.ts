import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { resetMockRepos } from '@/data/repos';

/**
 * Ends the session: drops every cached query and puts the mock repositories back to their
 * fixtures, so what the next screen renders is a signed-out app rather than the previous
 * account's data with a login on top.
 *
 * This is the ONE feature-facing hook allowed to touch the repository layer's reset. It exists
 * precisely so `ProfileSheetsHost` (and anything else that signs out) does not have to import
 * `@/data/repos` itself, which CLAUDE.md rule 3 forbids outside `src/data/**` — screens see a
 * hook from `@/data/queries` like every other data concern.
 *
 * Against a real API this becomes "drop the tokens and clear the caches": the `resetMockRepos()`
 * call is replaced by revoking/forgetting the credentials, and `queryClient.clear()` stays.
 */
export function useResetSession(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.clear();
    resetMockRepos();
  }, [queryClient]);
}
