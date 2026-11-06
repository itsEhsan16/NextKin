import { useEffect, useRef } from 'react';

import { Screen } from '@/ui/Screen';
import { Spinner } from '@/ui/motion';

import { useBuildActions } from '../hooks/useStartBuild';

/** Forwards a read job to the match step, replacing itself, once the source is known. */
export function BuildOpenMatch({ jdId }: { jdId: string }) {
  const actions = useBuildActions();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !jdId) return;
    sent.current = true;
    actions.openCompare({ jdId }, { replace: true });
  }, [actions, jdId]);
  return (
    <Screen edges={['top', 'bottom']}>
      <Spinner size={32} />
    </Screen>
  );
}
