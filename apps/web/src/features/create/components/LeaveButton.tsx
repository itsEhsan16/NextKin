'use client';

import type { Route } from 'next';
import type { useRouter } from 'next/navigation';

import { watchRun, type Watched } from '@/features/tailor/RunWatcher';
import { showToast } from '@/lib/toast';
import { Button } from '@/ui/Button';
import { Bell01, iconSize } from '@/ui/lineIcons';

/**
 * Walks away from a run that carries on (toreview §114, §131): the shell watches it and toasts
 * when it lands, the toast says the work goes on, and the reader goes to `to`.
 */
export function leaveRun(
  router: ReturnType<typeof useRouter>,
  run: Watched,
  carryOn: string,
  to: Route,
) {
  watchRun(run);
  showToast(carryOn, { tone: 'info' });
  router.push(to);
}

/** The one way out of a long run, the same in every flow: "Leave and notify me". */
export function LeaveButton({ onLeave }: { onLeave: () => void }) {
  return (
    <Button
      variant="secondary"
      size="lg"
      icon={<Bell01 aria-hidden className={iconSize.sm} />}
      onClick={onLeave}
    >
      Leave and notify me
    </Button>
  );
}
