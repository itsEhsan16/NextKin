'use client';

import { useState } from 'react';

/**
 * Whether content should fade in as it arrives (`toreview.md` §84):
 * - when `ready` turns on after the component mounted without it — loaded content replacing a
 *   skeleton;
 * - when given a `key` (a selected item's id), once the selection has moved off the item it
 *   mounted with — one job's details replacing another's, including going back to the first.
 *
 * Content already in the cache when the component mounted shows at once; fading it in would only
 * delay it.
 *
 * Pair it with a literal class: `animate-reveal` on content that mounts fresh, or
 * `*:animate-reveal` on a keyed card whose frame should stay put while its contents fade. Never on
 * something already on screen: adding the class there would blink it.
 */
export function useReveal(ready: boolean, key?: string): boolean {
  const [atMount] = useState(() => ({ ready, key }));
  // Derived during render, not in an effect: the first time the key moves, it has moved for good.
  const [moved, setMoved] = useState(false);
  if (!moved && key !== atMount.key) setMoved(true);

  if (!ready) return false;
  return !atMount.ready || moved || key !== atMount.key;
}
