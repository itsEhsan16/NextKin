'use client';

import { useCallback, useState } from 'react';

/**
 * Which part of a chart is in focus: the bar, segment or legend row under the pointer, or the one
 * keyboard focus is on. `bind(key)` gives an element the handlers that set it, so a segment and
 * its legend row can share one focus and light up together. Leaving clears it.
 */
export function useChartFocus<K extends string | number>() {
  const [active, setActive] = useState<K | null>(null);
  const clear = useCallback(() => setActive(null), []);

  const bind = useCallback(
    (key: K) => ({
      onMouseEnter: () => setActive(key),
      onMouseLeave: clear,
      onFocus: () => setActive(key),
      onBlur: clear,
    }),
    [clear],
  );

  return { active, bind, clear };
}
