import type { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { forgetResumes, keepResumesSaved } from '@/data/savedResumes';
import { useSessionStore } from '@/features/auth';

/**
 * Keeps the phone's copy of the resumes current (toreview §145.5), and wipes it. Whatever signs the
 * person out, nothing of theirs stays on the phone, in memory or saved. Checked once on mount too:
 * a device with no tokens can sign out before this subscribes.
 */
export function useSavedResumes(client: QueryClient) {
  useEffect(() => {
    const wipe = () => {
      forgetResumes();
      client.clear();
    };
    if (useSessionStore.getState().status === 'signed_out') wipe();
    const stopSaving = keepResumesSaved(client);
    const stopWatching = useSessionStore.subscribe((state, previous) => {
      if (previous.status === 'signed_in' && state.status === 'signed_out') wipe();
    });
    return () => {
      stopSaving();
      stopWatching();
    };
  }, [client]);
}
