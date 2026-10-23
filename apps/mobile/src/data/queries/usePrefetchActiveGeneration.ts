import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { repos } from '@/data/repos';

import { qk } from '@nextkin/shared/queries';

/**
 * Starts loading the in-flight generation without subscribing the caller to it.
 *
 * Home's progress card owns `useActiveGeneration()` so the run's 1.2 s ticks re-render the card
 * alone. The card mounts only once Home's own data is in, though, which would start its fetch a
 * whole round-trip late; Home calls this at mount so both load side by side, as before.
 */
export function usePrefetchActiveGeneration(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: qk.generations.active(),
      queryFn: () => repos.generations.getActive(),
    });
  }, [queryClient]);
}
