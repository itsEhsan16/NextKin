'use client';

import type { Generation, Job, Resume, User } from '@nextkin/shared/models';
import { useRouter } from 'next/navigation';

import { leaveRun } from '@/features/create/components/LeaveButton';
import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { tailorPath, targetPageHref, type TailorTargetRef } from '../tailorTarget';
import { ReviewStep } from './ReviewStep';
import { TailoringStep } from './TailoringStep';

/**
 * Step 3 of a run already started (734:1356, 734:2033): its progress, its result, or why it
 * stopped. Leaving while it runs is fine; the run carries on and says when it is ready.
 */
export function TailorRunView({
  target,
  run,
  job,
  resumes,
  user,
}: {
  target: TailorTargetRef;
  run: Generation | undefined;
  job: Job | undefined;
  /** The resumes it may have started from, to name the source while it runs. */
  resumes: readonly Resume[];
  user: User | undefined;
}) {
  const router = useRouter();
  if (!run || !job) return <Skeleton className="mx-auto h-160 w-full max-w-170 rounded-lg" />;
  if (run.status === 'failed') {
    return (
      <div className={cn(cardSurface, 'py-12')}>
        <StateView
          tone="danger"
          title="That run didn't finish"
          message={run.error ?? 'Nothing was charged. Go back and try again.'}
          actionLabel="Back to my choices"
          actionHref={tailorPath(
            target,
            run.tailor?.sourceResumeId ? { resumeId: run.tailor.sourceResumeId } : {},
          )}
        />
      </div>
    );
  }
  if (run.status === 'ready')
    return <ReviewStep job={job} generation={run} user={user} backHref={targetPageHref(target)} />;
  return (
    <TailoringStep
      job={job}
      generation={run}
      source={resumes.find((resume) => resume.id === run.tailor?.sourceResumeId)}
      onLeave={() => {
        const resumeId = run.tailor?.sourceResumeId;
        leaveRun(
          router,
          {
            runId: run.id,
            href: tailorPath(target, { run: run.id, ...(resumeId ? { resumeId } : {}) }),
            readyMessage: 'Your tailored resume is ready.',
            failedMessage: 'Tailoring didn’t finish. Nothing was charged.',
          },
          'Tailoring carries on. We’ll let you know here when it’s ready.',
          targetPageHref(target),
        );
      }}
    />
  );
}
