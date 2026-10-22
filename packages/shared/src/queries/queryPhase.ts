export type QueryPhase = 'pending' | 'error' | 'success';

/** The three fields of a TanStack query result the phase is decided from. */
type PhaseSource = { data: unknown; isPending: boolean; isError: boolean };

/**
 * Which of a screen's states a query is in — with data winning over an error.
 *
 * TanStack keeps the last good `data` when a *background* refetch fails and sets `isError`
 * alongside it. A screen that checks `isError` first swaps content the user is reading for a
 * full-page error because a silent refresh failed. Checked data-first, a failed refresh leaves the
 * content in place; only a query with nothing to show reports `error`.
 */
export function queryPhase(query: PhaseSource): QueryPhase {
  if (query.data !== undefined) return 'success';
  if (query.isError) return 'error';
  return query.isPending ? 'pending' : 'success';
}
