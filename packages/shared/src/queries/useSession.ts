import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { resetRepos } from '../repos';

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
 * Against the real API (P5-02) `resetRepos()` also forgets the HTTP repositories' cached versions;
 * ending the server session and dropping the tokens is the auth client's job, done before this.
 */
export function useResetSession(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.clear();
    resetRepos();
  }, [queryClient]);
}
