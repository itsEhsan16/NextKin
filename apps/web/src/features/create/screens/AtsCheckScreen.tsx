'use client';

import {
  isConsentRequired,
  queryPhase,
  useCancelGeneration,
  useExtractJd,
  useGeneration,
  useGenerationWatchProblem,
  useStartGeneration,
  useSubscription,
} from '@nextkin/shared/queries';
import { startErrorLine } from '@nextkin/shared/tailor/customize';
import { showToast } from '@/lib/toast';
import type { Route } from 'next';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { tailorPath, useTailorTarget } from '@/features/tailor/tailorTarget';
import { JobLogoTile } from '@/features/tailor/flow/EntityRow';
import { cn } from '@/lib/cn';
import { AtsCheckIllustration } from '@/ui/illustrations';
import { pageFrame } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StableLabel } from '@/ui/StableLabel';
import { StateView } from '@/ui/StateView';
import { EmptyStateArt } from '@/ui/illustrations';

import { AtsResult } from '../ats/AtsResult';
import { AtsUploadStep } from '../ats/AtsUploadStep';
import { RunProgress } from '../components/RunProgress';
import { allowanceNote, atsAllowance, START_FAILED } from '../createLibrary';
import { FlowHeader, flowPage } from '../jobFlow/FlowChrome';
import { JOB_FLOWS, type PickedJob } from '../jobFlow/jobFlow';
import { JobStep } from '../jobFlow/JobStep';
import { atsLines } from '../runLines';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

export type AtsCheckScreenProps = { resumeId?: string; step?: 'job'; runId?: string };

export function atsHref(q: { resumeId?: string; step?: 'job'; run?: string } = {}): Route {
  const p = new URLSearchParams();
  if (q.resumeId) p.set('resumeId', q.resumeId);
  if (q.step) p.set('step', q.step);
  if (q.run) p.set('run', q.run);
  const s = p.toString();
  return `/create/ats-check${s ? `?${s}` : ''}` as Route;
}

/**
 * ATS Check (toreview §126; ATS 01 and 03): the resume first (uploaded and read), then the job
 * (saved or from anywhere, step 1's own picker), then the check and the score.
 */
export function AtsCheckScreen({ resumeId, step, runId }: AtsCheckScreenProps) {
  const router = useGuardedRouter();
  const subscription = useSubscription();
  const extract = useExtractJd();
  const start = useStartGeneration();
  const cancel = useCancelGeneration();
  const run = useGeneration(runId ?? '');
  const g = run.data;
  const ref = g?.jobId
    ? ({ kind: 'job', id: g.jobId } as const)
    : ({ kind: 'jd', id: g?.jdId ?? '' } as const);
  const { job, jobError, refetch: refetchJob } = useTailorTarget(ref, '');
  const watch = useGenerationWatchProblem(runId ?? '');
  const allowance = atsAllowance(subscription.data?.usage);
  const steps = JOB_FLOWS['ats-check'].steps;

  const frame = (index: number, body: React.ReactNode, header = true) => (
    <div className={cn(pageFrame, flowPage)}>
      {header && (
        <FlowHeader
          backHref={'/' as Route}
          backLabel="Back to Home"
          eyebrow="ATS check"
          title={
            job && runId
              ? job.company
                ? `${job.title} · ${job.company}`
                : job.title
              : 'Check a resume against a job'
          }
          {...(job && runId ? { leading: <JobLogoTile job={job} /> } : {})}
          steps={steps}
          step={index}
          // A done step is a link back to it (owner, 2026-11-14).
          stepHrefs={[atsHref(), atsHref({ ...(resumeId ? { resumeId } : {}), step: 'job' })]}
        />
      )}
      <div key={`${index}-${runId ?? ''}`} className="animate-reveal">
        {body}
      </div>
    </div>
  );

  const check = (picked: PickedJob) => {
    if (!resumeId || allowance.spent) return;
    const begin = (jdId: string, jobId?: string) =>
      start.mutate(
        { kind: 'ats_check', sourceResumeId: resumeId, jdId, ...(jobId ? { jobId } : {}) },
        { onSuccess: (r) => router.replace(atsHref({ resumeId, run: r.id })) },
      );
    if (picked.kind === 'jd') begin(picked.id);
    else
      extract.mutate(
        { source: 'job', jobId: picked.id },
        { onSuccess: (draft) => begin(draft.id, picked.id) },
      );
  };

  if (runId) {
    // Only a run there is nothing to show of has failed to load: a background refetch that fails
    // keeps the live check on screen (toreview §260).
    if (queryPhase(run) === 'error' || g?.status === 'failed')
      return frame(
        2,
        <StateView
          tone="danger"
          title="The check didn’t finish"
          message={g?.error ?? 'Nothing was charged. Go back and try again.'}
          actionLabel="Back to the job"
          actionHref={atsHref({ ...(resumeId ? { resumeId } : {}), step: 'job' })}
        />,
      );
    // The job the check is against couldn't load: said, with a retry, not a skeleton for ever.
    if (g && !job && (jobError || (!g.jobId && !g.jdId)))
      return frame(
        2,
        <StateView
          tone="danger"
          title="We couldn’t load the job for this check"
          message="Check your connection and try again. Your check carries on."
          actionLabel="Try again"
          onAction={refetchJob}
        />,
      );
    if (g && g.status !== 'ready' && watch.problem)
      return frame(
        2,
        <StateView
          tone="danger"
          title={watch.problem.permanent ? 'We can’t follow this check' : 'Checking on your check'}
          message={watch.problem.message}
          actionLabel="Check again"
          onAction={watch.restart}
        />,
      );
    if (!g || !job) return frame(2, <Skeleton className="h-140 rounded-xl" />);
    if (g.status === 'ready' && g.atsCheck) {
      const fixHref = g.jobId
        ? tailorPath(
            { kind: 'job', id: g.jobId },
            { resumeId: g.sourceResumeId ?? '', step: 'enhance' },
          )
        : g.jdId
          ? tailorPath(
              { kind: 'jd', id: g.jdId },
              { resumeId: g.sourceResumeId ?? '', step: 'enhance' },
            )
          : undefined;
      return frame(
        3,
        <AtsResult
          generation={g}
          result={g.atsCheck}
          job={job}
          fixHref={fixHref}
          againHref={atsHref()}
          backHref={atsHref({ ...(resumeId ? { resumeId } : {}), step: 'job' })}
        />,
        false,
      );
    }
    if (g.status === 'ready')
      return frame(
        3,
        <StateView
          art={<EmptyStateArt object="trophy" />}
          title="Your check is done"
          message="The result is on your resume’s ATS Score tab."
          actionLabel="Open Resumes"
          actionHref={'/resumes' as Route}
        />,
      );
    return frame(
      2,
      <RunProgress
        runId={g.id}
        art={<AtsCheckIllustration aria-hidden className="h-auto w-24" />}
        title="Checking your resume"
        subtitle={job.company ? `Against ${job.company}’s job` : 'Against the job description'}
        meter="Checking"
        progress={g.progress}
        lines={atsLines(g)}
        note="This usually takes less than 30 seconds."
        action={
          <button
            type="button"
            disabled={cancel.isPending}
            onClick={() =>
              cancel.mutate(g.id, {
                onSuccess: () =>
                  router.replace(atsHref({ ...(resumeId ? { resumeId } : {}), step: 'job' })),
                onError: () =>
                  showToast('We couldn’t cancel the check. It may have finished; try again.', {
                    tone: 'error',
                  }),
              })
            }
            className={cn(
              BUTTON_VARIANT.secondary,
              'h-control-lg rounded-md px-5 text-body-l font-semibold',
            )}
          >
            <StableLabel label="Cancel" busyLabel="Cancelling…" busy={cancel.isPending} />
          </button>
        }
      />,
    );
  }

  if (step === 'job' && resumeId) {
    const failed = start.isError || (extract.isError && !extract.isPending);
    const failure = start.error ?? extract.error;
    // Consent has its own dialog; every other refusal says what it was (toreview §260).
    const failedLine =
      failed && !isConsentRequired(failure) ? startErrorLine(failure, START_FAILED) : null;
    return frame(
      1,
      <JobStep
        flow="ats-check"
        backHref={atsHref({ resumeId })}
        pickFailed={failed}
        note={
          failedLine
            ? failedLine
            : allowance.spent
              ? (allowanceNote(allowance, 'check', 'ATS checks') ?? '')
              : (allowanceNote(allowance, 'check', 'ATS checks') ??
                'Uses one of this month’s checks.')
        }
        // Held from the press: reading a saved job and starting the check are one action, so
        // a second press can't start (and spend) a second check (CR-20).
        {...(extract.isPending || start.isPending || start.isSuccess
          ? { busyLabel: extract.isPending ? 'Reading the job…' : 'Starting the check…' }
          : {})}
        spent={allowance.spent}
        onPicked={check}
      />,
    );
  }

  return frame(
    0,
    <AtsUploadStep
      resumeId={resumeId}
      onRead={(id) => router.replace(atsHref({ resumeId: id }))}
      onContinue={() => resumeId && router.push(atsHref({ resumeId, step: 'job' }))}
    />,
  );
}
