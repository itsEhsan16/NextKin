'use client';

import { zeroProgress, type Generation, type ResumeContent } from '@nextkin/shared/models';
import { useCurrentUser, useResumeContent } from '@nextkin/shared/queries';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { ResumeSheet } from '@/features/resumes/components/ResumeSheet';
import { cn } from '@/lib/cn';
import { stepCard } from '@/features/create/jobFlow/FlowChrome';
import { cardSurface } from '@/ui/Card';
import { ZeroResumeIllustration } from '@/ui/illustrations';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { createHref } from '../createLibrary';
import { zeroLines } from '../runLines';
import { LeaveButton, leaveRun } from './LeaveButton';
import { RunProgress } from './RunProgress';
import { ZeroCheckPanel } from './ZeroCheckPanel';

/**
 * ZERO 02–05 on the web (toreview §125): the draft being written, then the marked page beside the
 * checks, then the finished resume with Edit and Download. The checks live in the document, so
 * leaving and coming back picks up where the reader stopped.
 */
export function ZeroRunView({ generation }: { generation: Generation }) {
  const router = useRouter();
  const user = useCurrentUser();
  const resumeId = generation.resumeId ?? '';
  const ready = generation.status === 'ready';
  const content = useResumeContent(ready ? resumeId : '');
  const name =
    generation.zero?.fullName?.trim() ||
    [user.data?.firstName, user.data?.lastName].filter(Boolean).join(' ');

  if (generation.status === 'failed') {
    return (
      <div className={cn(cardSurface, 'py-12')}>
        <StateView
          tone="danger"
          title="Your draft didn’t finish"
          message={generation.error ?? 'Nothing was charged. Go back and try again.'}
          actionLabel="Back to the form"
          actionHref={createHref('zero-resume')}
        />
      </div>
    );
  }

  if (!ready) {
    return (
      <RunProgress
        art={<ZeroResumeIllustration aria-hidden className="h-30 w-28" />}
        title="Writing your first draft"
        subtitle="About a minute. Leave anytime — we’ll let you know when it’s ready."
        meter="Writing your draft"
        progress={generation.progress}
        lines={zeroLines(generation)}
        note="Anything we can’t know stays as a [blank] for you to fill in."
        action={
          <LeaveButton
            onLeave={() =>
              leaveRun(
                router,
                {
                  runId: generation.id,
                  href: createHref('zero-resume', { run: generation.id }),
                  readyMessage: 'Your first draft is ready to check.',
                  failedMessage: 'Your draft didn’t finish. Nothing was charged.',
                },
                'Writing carries on. We’ll let you know here when it’s ready.',
                '/' as Route,
              )
            }
          />
        }
      />
    );
  }

  const data = content.data;
  const body = data && data.kind !== 'cover_letter' ? (data as ResumeContent) : undefined;
  if (content.isError && !body) {
    return (
      <StateView
        tone="danger"
        title="Couldn't load your draft"
        message="It’s saved in Resumes. Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void content.refetch()}
      />
    );
  }

  const left = body ? zeroProgress(body).left : 0;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-5">
      <div className="lg:col-span-2">
        {body ? (
          <ZeroCheckPanel resumeId={resumeId} content={body} />
        ) : (
          <Skeleton className="h-120 w-full rounded-xl" />
        )}
      </div>
      <section
        aria-label="Your first draft"
        className={cn(stepCard, 'flex min-w-0 flex-col lg:col-span-3')}
      >
        <div className="flex items-center gap-2.5 border-b border-border-default py-3 pl-4.5 pr-4">
          <h2 className="text-title-l font-bold text-text-primary">Your first draft</h2>
          {left > 0 && (
            <span className="rounded-full bg-warning-50 px-2.5 py-0.5 text-caption-m font-semibold text-warning-text">
              {left} {left === 1 ? 'guess' : 'guesses'} left
            </span>
          )}
        </div>
        <div className="flex justify-center bg-neutral-100 px-5 pt-5.5">
          <div className="w-full max-w-2xl bg-surface-card shadow-popover">
            {body ? <ResumeSheet name={name} body={body} /> : <Skeleton className="h-200 w-full" />}
          </div>
        </div>
      </section>
    </div>
  );
}
