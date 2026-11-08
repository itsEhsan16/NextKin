import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useApplicationAsks } from '@/data/queries';

import { useApplyAskStore } from '../applyAskStore';

/**
 * Raises one waiting "Did you apply?" when its screen is on top, once per time the app is opened,
 * so a run finished last time, or a "not yet" from yesterday, is asked on the next open. One a
 * visit: a list of questions is not how anyone wants to be greeted.
 *
 * "Opened" means the app came to the foreground — typically back from the employer's site — not
 * every focus (§196). Asking, and refetching, on each focus popped the question the moment the
 * user tapped Back from a job onto Home, in the middle of what they were doing.
 */
export function useDueApplicationAsk() {
  const asks = useApplicationAsks();
  const open = useApplyAskStore((state) => state.open);
  const [focused, setFocused] = useState(false);
  const asked = useRef(false);
  const { refetch } = asks;
  const first = asks.data?.[0];

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      asked.current = false;
      void refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!first || asked.current || !focused) return;
    asked.current = true;
    open(first);
  }, [first, focused, open]);
}
