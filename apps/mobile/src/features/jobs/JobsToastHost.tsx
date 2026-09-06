import { Toast } from '@/ui/Toast';

import { useJobsStore } from './jobsStore';

/**
 * The Jobs feature's transient confirmations. Only one thing raises it today — sharing a job,
 * which has no screen and no visible result of its own, so the tap has to say something when the
 * OS sheet never appears.
 *
 * Mounted by the job detail screen rather than by the tabs layout: share lives on that pushed
 * screen, and a toast rendered underneath it would be invisible.
 */
export function JobsToastHost() {
  const toast = useJobsStore((state) => state.toast);
  const hideToast = useJobsStore((state) => state.hideToast);

  return <Toast visible={toast != null} message={toast ?? ''} onHide={hideToast} />;
}
