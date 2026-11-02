import type { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSessionStore } from '@/features/auth';

/**
 * Whatever signs the person out, nothing of theirs stays in memory for the next person. Checked once
 * on mount too: a device with no tokens can sign out before this subscribes.
 */
export function useWipeOnSignOut(client: QueryClient) {
  useEffect(() => {
    if (useSessionStore.getState().status === 'signed_out') client.clear();
    return useSessionStore.subscribe((state, previous) => {
      if (previous.status === 'signed_in' && state.status === 'signed_out') client.clear();
    });
  }, [client]);
}
