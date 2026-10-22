import { useState } from 'react';

/**
 * True once `value` has turned true *after* the component mounted: a run that finished while the
 * user watched, not one that was already finished when they opened it. Celebrations key off this,
 * so a revisit shows the result at rest instead of replaying the moment.
 */
export function useBecameTrue(value: boolean): boolean {
  const [atMount] = useState(value);
  return value && !atMount;
}
