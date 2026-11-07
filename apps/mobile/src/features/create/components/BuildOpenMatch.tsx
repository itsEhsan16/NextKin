import { useEffect, useRef } from 'react';

import { Screen } from '@/ui/Screen';

import { useBuildActions } from '../hooks/useStartBuild';

/**
 * Forwards a read job to the match step, replacing itself, once the source is known. It is gone
 * within a frame, so it draws an empty page rather than a spinner that would only flash (§191).
 */
export function BuildOpenMatch({ jdId }: { jdId: string }) {
  const actions = useBuildActions();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !jdId) return;
    sent.current = true;
    actions.openCompare({ jdId }, { replace: true });
  }, [actions, jdId]);
  return <Screen edges={['top', 'bottom']}>{null}</Screen>;
}
