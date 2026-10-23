import { useIsFetching } from '@tanstack/react-query';

/**
 * True while no query anywhere is fetching. The cue for idle-time work that must not compete
 * with a screen's own first load — warming the other tabs, for one.
 */
export function useQueriesSettled(): boolean {
  return useIsFetching() === 0;
}
