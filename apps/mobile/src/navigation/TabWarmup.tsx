import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useQueriesSettled } from '@/data/queries';

/**
 * Heaviest first: Jobs mounts a FlashList and a carousel, Resumes its card grid. Profile is no
 * longer a tab (§195): it opens from Home's greeting.
 */
const WARM_ORDER: readonly Href[] = ['/jobs', '/resumes'];

/**
 * Mounts the other tabs ahead of the first visit, one per idle slot, once the launch screen has
 * finished loading.
 *
 * Tabs are `lazy`, so a first visit used to pay for the whole mount (and the screen's first
 * fetch) in the same frames as the tab fade — a hitch, then a skeleton. Preloaded, the tab is
 * already built and its data already in the cache when the user arrives. `router.prefetch`
 * dispatches react-navigation's PRELOAD, which mounts the tab without focusing it.
 *
 * Renders nothing. Runs once per mount of the tabs layout (so again after signing back in).
 */
export function TabWarmup() {
  const router = useRouter();
  const settled = useQueriesSettled();
  const started = useRef(false);
  const handle = useRef<number | null>(null);

  useEffect(() => {
    if (started.current || !settled) return;
    started.current = true;
    const queue = [...WARM_ORDER];
    const next = () => {
      const href = queue.shift();
      if (href === undefined) {
        handle.current = null;
        return;
      }
      router.prefetch(href);
      handle.current = requestIdleCallback(next);
    };
    handle.current = requestIdleCallback(next);
    // The chain outlives this effect on purpose: the prefetched tabs start fetching, which flips
    // `settled` and re-runs it. Only unmounting stops it (below).
  }, [router, settled]);

  useEffect(
    () => () => {
      if (handle.current !== null) cancelIdleCallback(handle.current);
    },
    [],
  );

  return null;
}
