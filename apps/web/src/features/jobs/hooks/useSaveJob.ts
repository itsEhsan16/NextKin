'use client';

import type { Job } from '@nextkin/shared/models';
import { PlanLockedError, useToggleSaveJob } from '@nextkin/shared/queries';
import { useCallback } from 'react';

import { showToast } from '@/lib/toast';

export const SAVED_JOBS_CAP_MESSAGE =
  'Free saves up to 10 jobs. Remove one to save another, or upgrade to save more.';

/**
 * The bookmark on the web job surfaces (P11-04). The save is explicit (`saved: !job.isSaved`), so
 * a retry can never flip it back. Free's 11th save is refused (`PlanLockedError`): the optimistic
 * flip rolls back and a toast says why, since the web plan screen is still to come (§13.5).
 */
export function useSaveJob() {
  const { mutate, isPending, variables } = useToggleSaveJob();
  const toggle = useCallback(
    (job: Pick<Job, 'id' | 'isSaved'>) =>
      mutate(
        { id: job.id, saved: !job.isSaved },
        {
          onError: (error) => {
            if (error instanceof PlanLockedError)
              showToast(SAVED_JOBS_CAP_MESSAGE, { tone: 'info' });
          },
        },
      ),
    [mutate],
  );
  return { toggle, isPending, savingId: isPending ? variables?.id : undefined };
}
