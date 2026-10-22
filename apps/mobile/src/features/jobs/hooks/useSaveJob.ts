import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import type { Job } from '@/data/models';
import { PlanLockedError, useToggleSaveJob } from '@/data/queries';

/**
 * The bookmark on every job surface (P11-04). Saving is explicit (`saved: !job.isSaved`), so a
 * retried tap can never flip it back. Free saves up to 10 open listings; the 11th answers
 * `PlanLockedError`, the optimistic flip is rolled back, and the plan screen opens on the
 * `saved_jobs` reason the billing artboards already name (V2 §13.5).
 */
export function useSaveJob() {
  const router = useRouter();
  const { mutate, isPending, variables } = useToggleSaveJob();
  const toggle = useCallback(
    (job: Pick<Job, 'id' | 'isSaved'>) =>
      mutate(
        { id: job.id, saved: !job.isSaved },
        {
          onError: (error) => {
            if (error instanceof PlanLockedError)
              router.push({ pathname: '/upgrade', params: { reason: 'saved_jobs' } });
          },
        },
      ),
    [mutate, router],
  );
  return { toggle, isPending, savingId: isPending ? variables?.id : undefined };
}
