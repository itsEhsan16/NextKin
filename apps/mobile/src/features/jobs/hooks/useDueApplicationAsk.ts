import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { useApplicationAsks } from '@/data/queries';

import { useApplyAskStore } from '../applyAskStore';

/**
 * Raises one waiting "Did you apply?" each time its screen comes into focus, so a run finished last
 * time, or a "not yet" from yesterday, is asked on the next open. One a visit: a list of questions
 * is not how anyone wants to be greeted.
 */
export function useDueApplicationAsk() {
  const asks = useApplicationAsks();
  const open = useApplyAskStore((state) => state.open);
  const asked = useRef(false);
  const focused = useRef(false);
  const { refetch } = asks;
  const first = asks.data?.[0];

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      asked.current = false;
      void refetch();
      return () => {
        focused.current = false;
      };
    }, [refetch]),
  );

  useEffect(() => {
    if (!first || asked.current || !focused.current) return;
    asked.current = true;
    open(first);
  }, [first, open]);
}
