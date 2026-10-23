'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { pageFrame } from '@/ui/pageFrame';

import { FlowHeader } from './FlowChrome';
import { afterJob, JOB_FLOWS } from './jobFlow';
import { JobStep } from './JobStep';

/**
 * Build Resume and Tailor to a Job (toreview §126): step 1, the job, then on to the comparison and
 * the choices for it. The page sits in the app's frame, full width, as the tailor boards do.
 */
export function JobFlowScreen({ flow }: { flow: 'build' | 'tailor' }) {
  const router = useRouter();
  const copy = JOB_FLOWS[flow];
  return (
    <div className={cn(pageFrame, 'flex flex-col gap-5 pb-8')}>
      <FlowHeader
        backHref={'/' as Route}
        backLabel="Back to Home"
        eyebrow={copy.eyebrow}
        title="Choose the job first"
        steps={copy.steps}
        step={0}
      />
      <JobStep flow={flow} onPicked={(job) => router.push(afterJob(flow, job))} />
    </div>
  );
}
