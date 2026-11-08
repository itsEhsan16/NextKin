import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { isGenerationTerminal } from '../models';
import { repos } from '../repos';

import { qk } from './keys';
import { watchGeneration } from './useGenerations';

/**
 * The in-flight generation (or null). While one is active this subscribes to
 * live progress ticks and pushes them straight into the cache, so a progress
 * card re-renders without polling. When it completes, what it changed is refetched.
 */
export function useActiveGeneration() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: qk.generations.active(),
    queryFn: () => repos.generations.getActive(),
  });

  const activeId = query.data && !isGenerationTerminal(query.data.status) ? query.data.id : null;

  useEffect(() => {
    if (!activeId) return undefined;
    // The same shared watch as the run's own screen (§196): one poll, one sweep when it ends.
    return watchGeneration(queryClient, activeId);
  }, [activeId, queryClient]);

  return query;
}
