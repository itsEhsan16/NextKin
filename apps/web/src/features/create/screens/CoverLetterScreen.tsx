'use client';

import { tailorableResumes, type CoverLetterTone } from '@nextkin/shared/models';
import {
  useGeneration,
  useResumes,
  useStartGeneration,
  useSubscription,
} from '@nextkin/shared/queries';
import type { Route } from 'next';
import { useState } from 'react';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { ResumeStep } from '@/features/tailor/flow/ResumeStep';
import { JobLogoTile } from '@/features/tailor/flow/EntityRow';
import { tailorPath, useTailorTarget, type TailorTargetRef } from '@/features/tailor/tailorTarget';
import { cn } from '@/lib/cn';
import { CoverLetterIllustration } from '@/ui/illustrations';
import { pageFrame } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { LeaveButton, leaveRun } from '../components/LeaveButton';
import { RunProgress } from '../components/RunProgress';
import { CoverReady } from '../cover/CoverReady';
import { CoverTailorFirst, CoverToneStep } from '../cover/CoverSteps';
import { allowanceNote, coverAllowance, START_FAILED } from '../createLibrary';
import { FlowHeader } from '../jobFlow/FlowChrome';
import { JobStep } from '../jobFlow/JobStep';
import { coverLines } from '../runLines';

const STEPS = ['Job', 'Resume', 'Your letter'] as const;

export type CoverLetterScreenProps = {
  target?: TailorTargetRef;
  resumeId?: string;
  step?: 'resume' | 'tone';
  runId?: string;
};

/** `/create/cover-letter` with the job, the resume, the step or the run in its query. */
export function coverHref(
  q: { target?: TailorTargetRef; resumeId?: string; step?: 'resume' | 'tone'; run?: string } = {},
): Route {
  const p = new URLSearchParams();
  if (q.target) p.set(q.target.kind, q.target.id);
  if (q.resumeId) p.set('resumeId', q.resumeId);
  if (q.step) p.set('step', q.step);
  if (q.run) p.set('run', q.run);
  const s = p.toString();
  return `/create/cover-letter${s ? `?${s}` : ''}` as Route;
}

/**
 * Cover Letter (toreview §126; COVER 01, 01b, 03): the job, then the resume tailored for it (or
 * tailoring first, when there is none), then the tone, the writing, and the letter itself.
 */
export function CoverLetterScreen({
  target,
  resumeId,
  step = 'resume',
  runId,
}: CoverLetterScreenProps) {
  const router = useGuardedRouter();
  const { job, jobError, refetch } = useTailorTarget(target ?? { kind: 'jd', id: '' }, '');
  const resumes = useResumes();
  const subscription = useSubscription();
  const start = useStartGeneration();
  const run = useGeneration(runId ?? '');
  const [tone, setTone] = useState<CoverLetterTone>('professional');
  const allowance = coverAllowance(subscription.data?.usage);
  const open = (id: string) =>
    router.replace(
      coverHref({ ...(target ? { target } : {}), ...(resumeId ? { resumeId } : {}), run: id }),
    );

  const frame = (stepIndex: number, body: React.ReactNode, header = true) => (
    <div className={cn(pageFrame, 'flex flex-col gap-5 pb-8')}>
      {header && (
        <FlowHeader
          backHref={'/' as Route}
          backLabel="Back to Home"
          eyebrow={job ? 'Cover letter for' : 'Cover letter'}
          title={
            job
              ? job.company
                ? `${job.title} · ${job.company}`
                : job.title
              : 'Choose the job first'
          }
          {...(job ? { leading: <JobLogoTile job={job} /> } : {})}
          steps={STEPS}
          step={stepIndex}
        />
      )}
      <div key={`${stepIndex}-${runId ?? ''}`} className="animate-reveal">
        {body}
      </div>
    </div>
  );

  if (!target)
    return frame(
      0,
      <JobStep
        flow="cover-letter"
        note="Nothing is spent until you write the letter."
        onPicked={(picked) => router.push(coverHref({ target: picked, step: 'resume' }))}
      />,
    );
  // A failed load says what failed and retries it, rather than holding the placeholder (§131).
  if (jobError || resumes.isError)
    return frame(
      1,
      <StateView
        tone="danger"
        title={jobError ? 'We couldn’t load this job' : 'We couldn’t load your resumes'}
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          refetch();
          void resumes.refetch();
        }}
      />,
    );
  if (!job || !resumes.data) return frame(1, <Skeleton className="h-110 rounded-xl" />);

  if (runId) {
    const g = run.data;
    if (run.isError || g?.status === 'failed')
      return frame(
        2,
        <StateView
          tone="danger"
          title="Your letter didn’t finish"
          message={g?.error ?? 'Nothing was charged. Go back and try again.'}
          actionLabel="Back to the tone"
          actionHref={coverHref({ target, ...(resumeId ? { resumeId } : {}), step: 'tone' })}
        />,
      );
    if (!g) return frame(2, <Skeleton className="h-140 rounded-xl" />);
    if (g.status === 'ready')
      return frame(
        3,
        <CoverReady
          key={g.id}
          generation={g}
          job={job}
          backHref={coverHref({ target, ...(resumeId ? { resumeId } : {}), step: 'tone' })}
          onStarted={open}
        />,
        false,
      );
    return frame(
      2,
      <RunProgress
        art={<CoverLetterIllustration aria-hidden className="h-auto w-28" />}
        title="Writing your cover letter"
        subtitle={job.company ? `${job.title} · ${job.company}` : job.title}
        meter="Writing your letter"
        progress={g.progress}
        lines={coverLines(g)}
        note="Nothing goes in the letter that isn’t on your resume."
        action={
          <LeaveButton
            onLeave={() =>
              leaveRun(
                router,
                {
                  runId: g.id,
                  href: coverHref({ ...(target ? { target } : {}), run: g.id }),
                  readyMessage: 'Your cover letter is ready.',
                  failedMessage: 'Your letter didn’t finish. Nothing was charged.',
                },
                'Writing carries on. We’ll let you know here when it’s ready.',
                '/' as Route,
              )
            }
          />
        }
      />,
    );
  }

  const all = tailorableResumes(resumes.data);
  // A listing knows which resumes were tailored for it; a pasted job description does not, so any resume can carry it.
  const fit = target.kind === 'job' ? all.filter((r) => r.linkedJobId === target.id) : all;
  const picked = fit.find((r) => r.id === resumeId);

  if (step === 'tone' && picked) {
    return frame(
      2,
      <CoverToneStep
        job={job}
        resume={picked}
        tone={tone}
        onTone={setTone}
        changeJob={coverHref()}
        changeResume={coverHref({ target, resumeId: picked.id, step: 'resume' })}
        note={
          start.isError
            ? START_FAILED
            : allowance.spent
              ? (allowanceNote(allowance, 'cover letter', 'cover letters') ?? '')
              : // What it costs, before it is spent (V2 §13.5; redesign R6e, audit CR-32).
                [
                  allowanceNote(allowance, 'cover letter', 'cover letters'),
                  'Saved to Resumes. You can edit every line before you download.',
                ]
                  .filter(Boolean)
                  .join(' · ')
        }
        noteTone={start.isError ? 'danger' : 'neutral'}
        spent={allowance.spent}
        pending={start.isPending}
        onWrite={() =>
          start.mutate(
            {
              kind: 'cover_letter',
              sourceResumeId: picked.id,
              tone,
              ...(target.kind === 'job' ? { jobId: target.id } : { jdId: target.id }),
            },
            { onSuccess: (g) => open(g.id) },
          )
        }
      />,
    );
  }

  if (fit.length === 0)
    return frame(
      1,
      <CoverTailorFirst
        job={job}
        tailorHref={tailorPath(target, { step: 'resume' })}
        backHref={coverHref()}
      />,
    );
  const value = picked?.id ?? fit[0]?.id;
  return frame(
    1,
    <ResumeStep
      job={job}
      resumes={fit}
      loading={false}
      failed={false}
      onRetry={() => void resumes.refetch()}
      value={value}
      onPick={(id) => router.replace(coverHref({ target, resumeId: id, step: 'resume' }))}
      onContinue={() => value && router.push(coverHref({ target, resumeId: value, step: 'tone' }))}
      backHref={coverHref()}
      copy={{
        of: 3,
        title: 'Which resume is the letter built from?',
        lede: 'Pick the resume you tailored for this job. The letter repeats only what it shows.',
        note: 'Nothing is spent until you write the letter.',
      }}
    />,
  );
}
