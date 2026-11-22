'use client';

import type { Generation, Job, Resume, User } from '@nextkin/shared/models';
import {
  isConsentRequired,
  useGenerationWatchProblem,
  useRetryGeneration,
} from '@nextkin/shared/queries';
import { startErrorLine } from '@nextkin/shared/tailor/customize';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { leaveRun } from '@/features/create/components/LeaveButton';
import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { Button, buttonClass } from '@/ui/Button';
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
  const retry = useRetryGeneration();
  const watch = useGenerationWatchProblem(run?.id ?? '');
  if (!run || !job) return <Skeleton className="h-110 w-full flex-1 rounded-xl" />;
  const build = run.origin === 'build';
  // Back to the step the choices were made on, in the same mode: a build run's keywords, a
  // tailored run's resume and its Enhance choices.
  const choicesHref = build
    ? tailorPath(target, { step: 'enhance', mode: 'build' })
    : tailorPath(target, {
        step: 'enhance',
        ...(run.tailor?.sourceResumeId ? { resumeId: run.tailor.sourceResumeId } : {}),
      });
  if (run.status === 'failed') {
    return (
      <div className={cn(cardSurface, 'flex flex-col items-center py-12')}>
        <StateView
          tone="danger"
          title="That run didn't finish"
          message={`${run.error ?? 'Something stopped it.'} Nothing was charged.`}
          className="pb-0"
        />
        {/* The same run again, as it was asked (owner, 2026-11-22); or back to change the choices. */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="primary"
            loading={retry.isPending}
            onClick={() =>
              retry.mutate(run.id, {
                onError: (error) => {
                  if (!isConsentRequired(error))
                    showToast(startErrorLine(error, 'We couldn’t start it again. Try again.'), {
                      tone: 'error',
                    });
                },
              })
            }
          >
            Try again
          </Button>
          <Link href={choicesHref} className={buttonClass({ variant: 'secondary', size: 'md' })}>
            Back to my choices
          </Link>
        </div>
      </div>
    );
  }
  // The run's progress can't be read: say so, instead of a bar that never moves.
  if (run.status !== 'ready' && watch.problem) {
    return (
      <div className={cn(cardSurface, 'py-12')}>
        <StateView
          tone="danger"
          title={watch.problem.permanent ? 'We can’t follow this run' : 'Checking on your run'}
          message={watch.problem.message}
          actionLabel="Check again"
          onAction={watch.restart}
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
