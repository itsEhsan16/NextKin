import { useCallback } from 'react';

import type { Job } from '@/data/models';
import { applyPageOf, useAskAboutApplication } from '@/data/queries';
import { openExternalUrl } from '@/lib';
import { showAppToast } from '@/ui/Toast';

import { useApplyAskStore } from '../applyAskStore';

export const APPLY_PAGE_UNAVAILABLE = 'We couldn’t open this job’s page. Try again in a moment.';

/**
 * "Apply now". NextKin submits nothing, so this opens the employer's page and, back in the app,
 * asks whether they applied. The Applied list only ever holds what the candidate told us.
 */
export function useApplyFlow(job: Job | undefined) {
  const askAbout = useAskAboutApplication();
  const openAsk = useApplyAskStore((state) => state.open);

  const apply = useCallback(() => {
    if (!job) return;
    const page = applyPageOf(job);
    void (async () => {
      if (!page || (await openExternalUrl(page)) === 'unavailable') {
        showAppToast(APPLY_PAGE_UNAVAILABLE, 'error');
        return;
      }
      const ask = await askAbout.mutateAsync({ jobId: job.id }).catch(() => null);
      if (ask) openAsk(ask);
    })();
  }, [askAbout, job, openAsk]);

  return { apply };
}
