'use client';

import { zeroProgress, type ResumeContent } from '@nextkin/shared/models';
import { useGeneration, useResumeContent } from '@nextkin/shared/queries';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { cardSurface } from '@/ui/Card';
import { cn } from '@/lib/cn';
import { pageFrame } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { FlowHeader } from '../jobFlow/FlowChrome';
import { ZeroRunView } from '../components/ZeroRunView';
import { ZeroSetup } from '../components/ZeroSetup';
import { createHref } from '../createLibrary';

const STEPS = ['Basics', 'First draft', 'Check it', 'Done'] as const;

export type ZeroResumeScreenProps = { runId?: string; role?: string; jobId?: string };

/**
 * Zero Resume on the web (toreview §125, mobile ZERO 01–05): a first resume from three answers,
 * written, checked guess by guess, then downloaded. `?run=` reopens a started run where it is.
 */
export function ZeroResumeScreen({ runId, role, jobId }: ZeroResumeScreenProps) {
  const router = useRouter();
  const run = useGeneration(runId ?? '');
  const ready = run.data?.status === 'ready';
  const content = useResumeContent(ready ? (run.data?.resumeId ?? '') : '');
  const data = content.data;
  const body = data && data.kind !== 'cover_letter' ? (data as ResumeContent) : undefined;
  const finished = body ? zeroProgress(body).left === 0 : false;
  const step = !runId ? 0 : !ready ? 1 : finished ? 3 : 2;

  let page;
  if (!runId) {
    page = (
      <ZeroSetup
        {...(role ? { role } : {})}
        {...(jobId ? { jobId } : {})}
        onStarted={(id) => router.replace(createHref('zero-resume', { run: id }))}
      />
    );
  } else if (run.isError) {
    page = (
      <div className={`${cardSurface} py-12`}>
        <StateView
          tone="danger"
          title="Couldn't load this draft"
          message="Check your connection and try again. Your drafts are in Resumes."
          actionLabel="Try again"
          onAction={() => void run.refetch()}
        />
      </div>
    );
  } else if (!run.data) {
    page = <Skeleton className="h-140 w-full rounded-xl" />;
  } else {
    page = <ZeroRunView generation={run.data} />;
  }

  return (
    <div className={cn(pageFrame, 'flex flex-col gap-5 pb-8')}>
      <FlowHeader
        backHref={'/' as Route}
        backLabel="Back to Home"
        eyebrow="Zero Resume"
        title={run.data?.zero?.targetTitle?.trim() || 'Start from nothing'}
        steps={STEPS}
        step={step}
      />
      <div key={runId ? 'run' : 'setup'} className="animate-reveal">
        {page}
      </div>
    </div>
  );
}
