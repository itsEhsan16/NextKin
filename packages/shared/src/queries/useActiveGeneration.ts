import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { isGenerationTerminal } from '@/data/models';
import { repos } from '@/data/repos';

import { qk } from './keys';

/**
 * The in-flight generation (or null). While one is active this subscribes to
 * live progress ticks and pushes them straight into the cache, so a progress
 * card re-renders without polling. When it completes, resumes are refetched.
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
    return repos.generations.subscribe(activeId, (generation) => {
      queryClient.setQueryData(qk.generations.active(), generation);
      if (isGenerationTerminal(generation.status)) {
        void queryClient.invalidateQueries({ queryKey: qk.resumes.all });
        void queryClient.invalidateQueries({ queryKey: qk.user.subscription() });
      }
    });
  }, [activeId, queryClient]);

  return query;
}
