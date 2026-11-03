'use client';

import { defaultTailorPick, tailorableResumes } from '@nextkin/shared/models';
import {
  queryPhase,
  useCurrentUser,
  useGeneration,
  useResumes,
  useSubscription,
} from '@nextkin/shared/queries';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { createHref } from '@/features/create/createLibrary';
import { FlowHeader } from '@/features/create/jobFlow/FlowChrome';
import { jobFlowHref } from '@/features/create/jobFlow/jobFlow';
import { cn } from '@/lib/cn';
import { replaceQuery } from '@/lib/replaceQuery';
import { useReveal } from '@/lib/useReveal';
import { pageFillMin, pageFrame } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { TailorResumeDialog } from '../components/TailorResumeDialog';
import { TailorRunView } from '../components/TailorRunView';
import { BuildEnhanceStep } from '../flow/BuildSteps';
import { JobLogoTile } from '../flow/EntityRow';
import { EnhanceStep } from '../flow/EnhanceStep';
import { MethodStep } from '../flow/MethodStep';
import { UploadRow } from '../flow/ResumeStep';
import { useBuildFlow } from '../flow/useBuildFlow';
import {
  tailorPath,
  targetPageHref,
  useTailorTarget,
  type TailorStep,
  type TailorTargetRef,
} from '../tailorTarget';
import { useTailorChoices, useTailorRun } from '../useTailorRun';

const STEPS = ['Job', 'Resume', 'Enhance'] as const;
const STEP_INDEX: Record<TailorStep, number> = { resume: 1, enhance: 2 };

export type TailorScreenProps = {
  target: TailorTargetRef;
  /** The resume picked in step 2; else the base. */
  resumeId?: string;
  /** A run already started: the flow opens on its progress or its result. */
  runId?: string;
  /** Home's Build Resume (toreview §125–§126): a new resume from the profile, not a tailored one. */
  build?: boolean;
  /** Which of the W-FLOW steps (toreview §126): without one, the resume when none is named. */
  step?: TailorStep;
};

/**
 * The job → resume flow after step 1 (W-FLOW 02–04, toreview §126): which resume (or a build from
 * the profile, or no resume yet), the comparison and fix plan, what to add, then the run and its
 * result. One header and one step line throughout; each step is its own address, so Back works.
 */
export function TailorScreen({
  target,
  resumeId: requested,
  runId,
  build = false,
  step: asked,
}: TailorScreenProps) {
  const router = useRouter();
  const user = useCurrentUser();
  const resumes = useResumes();
  const subscription = useSubscription();
  const run = useGeneration(runId ?? '');
  const tailorable = tailorableResumes(resumes.data ?? []);
  const [picked, setPicked] = useState<string | undefined>(requested);
  const resumeId = picked ?? defaultTailorPick(tailorable, requested) ?? '';
  const { job, jobError, comparison, refetch } = useTailorTarget(target, resumeId);
  const tailor = useTailorRun(target);
  const choices = useTailorChoices();
  const builder = useBuildFlow(target, build);
  const [choosing, setChoosing] = useState(false);

  const step: TailorStep = asked ?? (requested ? 'enhance' : 'resume');
  const pick = (id: string) => {
    setChoosing(false);
    if (id === resumeId) return;
    setPicked(id);
    choices.resetKeywords();
    // A swap is kept in the address, so a reload keeps the same resume.
    replaceQuery('resumeId', id);
  };
  const switched = useReveal(true, runId ? `run-${run.data?.status === 'ready'}` : step);

  const usage = subscription.data?.usage;
  const limit = usage?.generationsLimit ?? 0;
  const left = Math.max(0, limit - (usage?.generationsUsed ?? 0));
  const spent = usage != null && limit > 0 && left === 0;
  const quota = spent
    ? `You’ve used all ${limit} tailored resumes this month.`
    : `Uses 1 of your ${limit} tailored resumes this month.`;
  const noResumes = resumes.data != null && tailorable.length === 0;
  const zeroHref = createHref('zero-resume', {
    role: job?.title,
    ...(target.kind === 'job' ? { jobId: target.id } : {}),
  });

  // Each failure names what didn't load (toreview §131); one retry fetches everything again.
  const failure = jobError
    ? 'We couldn’t load this job'
    : resumes.isError
      ? 'We couldn’t load your resumes'
      : queryPhase(comparison) === 'error'
        ? 'We couldn’t compare your resume with this job'
        : run.isError
          ? 'We couldn’t load this tailoring run'
          : builder.failed
            ? 'We couldn’t prepare your new resume'
            : null;
  if (failure) {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          tone="danger"
          title={failure}
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            refetch();
            void resumes.refetch();
            if (runId) void run.refetch();
          }}
        />
      </div>
    );
  }

  const wait = <Skeleton className="h-110 rounded-lg" />;
  let body: ReactNode = wait;
  if (runId) {
    body = (
      <TailorRunView
        target={target}
        run={run.data}
        job={job}
        resumes={tailorable}
        user={user.data}
      />
    );
  } else if (!job || !resumes.data) {
    body = wait;
  } else if (step === 'resume') {
    const hasRoles = (builder.profile.data?.experiences.length ?? 0) > 0;
    body = (
      <MethodStep
        job={job}
        resumeTitle={noResumes ? undefined : tailorable.find((r) => r.id === resumeId)?.title}
        profile={builder.profile.data}
        // A resume to tailor when there is one; else the profile, else an upload (toreview §155).
        initial={!noResumes ? 'tailor' : hasRoles ? 'profile' : 'upload'}
        jobHref={jobFlowHref('build')}
        zeroHref={zeroHref}
        onChangeResume={() => setChoosing(true)}
        onTailor={() => router.push(tailorPath(target, { step: 'enhance', resumeId }))}
        onProfile={() =>
          router.push(
            hasRoles
              ? tailorPath(target, { step: 'enhance', mode: 'build' })
              : ('/profile' as Route),
          )
        }
        onUploaded={(id) => router.push(tailorPath(target, { step: 'enhance', resumeId: id }))}
      />
    );
  } else if (build) {
    const back = tailorPath(target, { step: 'resume', mode: 'build' });
    if (!builder.comparison) body = wait;
    else
      body = (
        <BuildEnhanceStep
          job={job}
          comparison={builder.comparison}
          added={builder.added}
          onAdded={builder.setAdded}
          allowanceNote={quota}
          spent={spent}
          pending={builder.pending}
          backHref={back}
          onCreate={builder.create}
        />
      );
  } else if (comparison.data) {
    const measured = comparison.data;
    const back = tailorPath(target, { step: 'resume', resumeId });
    const toggle = (keyword: string, on: boolean) =>
      choices.setAdded(
        on ? [...choices.added, keyword] : choices.added.filter((k) => k !== keyword),
      );
    body = (
      <EnhanceStep
        job={job}
        comparison={measured}
        resume={tailorable.find((r) => r.id === resumeId)}
        onChangeResume={() => setChoosing(true)}
        onToggle={toggle}
        choices={choices}
        allowanceNote={quota}
        spent={spent}
        pending={tailor.pending}
        backHref={back}
        onCreate={() => !spent && tailor.create(measured, choices.choices)}
      />
    );
  }

  const done = runId && run.data?.status === 'ready';
  return (
    <div className={cn(pageFrame, 'flex flex-col gap-5 pb-8')}>
      {/* The finished resume needs no step line (owner, toreview §120): its toolbar has the way back. */}
      {done ? null : job ? (
        <FlowHeader
          backHref={targetPageHref(target)}
          backLabel="Back to the job"
          eyebrow={build ? 'Building for' : 'Tailoring for'}
          title={job.company ? `${job.title} · ${job.company}` : job.title}
          leading={<JobLogoTile job={job} />}
          steps={STEPS}
          step={runId ? STEPS.length : STEP_INDEX[step]}
        />
      ) : (
        <Skeleton className="h-10 w-full rounded-md" />
      )}
      <div key={runId ? 'run' : step} className={cn(switched && 'animate-reveal')}>
        {body}
      </div>
      {job && (
        <TailorResumeDialog
          open={choosing}
          onOpenChange={setChoosing}
          target={{ title: job.title, ...(job.company ? { company: job.company } : {}) }}
          resumes={tailorable}
          phase={queryPhase(resumes)}
          onRetry={() => void resumes.refetch()}
          upload={(choose) => <UploadRow onRead={choose} />}
          value={resumeId}
          onContinue={pick}
        />
      )}
    </div>
  );
}
