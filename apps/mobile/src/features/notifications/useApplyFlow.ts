import { useCallback, useState } from 'react';

import type { Job } from '@/data/models';
import { useApplyToJob } from '@/data/queries';
import { getPushPermission } from '@/lib';

import { useNotificationsStore } from './notificationsStore';

/**
 * NOTIF 07's post-apply choreography: submit the application, confirm with the toast
 * ("Application sent to Stripe"), and — only while the push permission has never been asked —
 * raise the contextual primer. The host screen renders <Toast/> and <PushPrimerHost/>.
 */
export function useApplyFlow(job: Job | undefined) {
  const [toastVisible, setToastVisible] = useState(false);
  const applyMutation = useApplyToJob();
  const openPrimer = useNotificationsStore((state) => state.openPrimer);

  const apply = useCallback(() => {
    if (!job) return;
    applyMutation.mutate(job.id, {
      onSuccess: () => {
        setToastVisible(true);
        void getPushPermission().then((status) => {
          // Already granted or hard-denied: the ask would be noise (note 1:2939).
          if (status === 'undetermined') openPrimer(job.company);
        });
      },
    });
  }, [applyMutation, job, openPrimer]);

  const hideToast = useCallback(() => setToastVisible(false), []);

  return {
    apply,
    toastVisible,
    hideToast,
    toastMessage: job ? `Application sent to ${job.company}` : '',
  };
}
