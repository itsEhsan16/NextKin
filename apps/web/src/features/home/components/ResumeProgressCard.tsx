import { resumeHref } from '@/features/resumes/resumeHref';

import type { Resume } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { formatRelativeTime } from '@/lib/format';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/ProgressBar';
import { ScoreRing } from '@/ui/ScoreRing';
import { SectionHeader } from '@/ui/SectionHeader';
import { Skeleton } from '@/ui/Skeleton';
import { SkeletonCircle, SkeletonLines } from '@/ui/SkeletonShapes';
import { StateView } from '@/ui/StateView';
import { CheckIcon } from '@/ui/icons';

export type ResumeProgressCardProps = {
  resume?: Resume;
  status: 'pending' | 'error' | 'success';
  onRetry: () => void;
};

/** "Your Resume Progress" (286:598) — the most recently updated finished resume. */
export function ResumeProgressCard({ resume, status, onRetry }: ResumeProgressCardProps) {
  // What replaces the skeleton fades in; content already cached on arrival shows at once.
  const reveal = useReveal(status !== 'pending');
  return (
    <Card loading={status === 'pending'} className="w-full p-6 lg:w-[380px] lg:shrink-0">
      <SectionHeader
        title="Your Resume Progress"
        actionHref={resume ? resumeHref(resume.id) : undefined}
      />

      {/* The row traced as thumbnail, lines and ring, then the pills, at their loaded sizes (§196). */}
      {status === 'pending' && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <Skeleton className="h-[76px] w-16 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <SkeletonLines widths={['w-4/5', 'w-1/2']} />
              <Skeleton className="h-2 rounded-full" />
            </div>
            <SkeletonCircle className="size-[78px]" />
          </div>
          <Skeleton className="mt-5 h-8 w-4/5 rounded-full" />
        </>
      )}

      {status === 'error' && (
        <StateView
          className={reveal ? 'animate-reveal' : undefined}
          tone="danger"
          title="Couldn't load your resume"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={onRetry}
        />
      )}

      {status === 'success' && !resume && (
        <StateView
          className={reveal ? 'animate-reveal' : undefined}
          title="No resumes yet"
          message="Build your first resume and its score will show up here."
        />
      )}

      {status === 'success' && resume && (
        <>
          <div className={cn('mt-4 flex items-center gap-3', reveal && 'animate-reveal')}>
            <div aria-hidden className="h-[76px] w-16 shrink-0 rounded-md bg-surface-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-title-l text-text-primary">{resume.title}</p>
              <p className="mt-0.5 text-body-s text-text-tertiary">
                Last updated {formatRelativeTime(resume.updatedAt)}
              </p>
              {resume.completeness != null && (
                <ProgressBar
                  className="mt-3"
                  value={resume.completeness}
                  label={`${resume.title} completeness`}
                  sweep={reveal}
                />
              )}
            </div>
            {resume.atsScore != null && (
              /* The board says "ATS Score"; V2 §7.8 says "NextKin Score". Rule 7 keeps the
                 board's word and toreview.md carries the conflict. */
              <ScoreRing score={resume.atsScore} label="ATS Score" sweep={reveal} />
            )}
          </div>

          {resume.validation && (
            <ul className={cn('mt-5 flex flex-wrap gap-2', reveal && 'animate-reveal')}>
              <ValidationPill ok={resume.validation.timelineValid} label="Timeline Valid" />
              <ValidationPill ok={resume.validation.atsOptimized} label="ATS Optimized" />
              <ValidationPill ok={resume.validation.jdMatched} label="JD Matched" />
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

function ValidationPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex h-8 items-center gap-1.5 rounded-full bg-neutral-50 px-3">
      <CheckIcon
        className={ok ? 'size-3.5 text-success-text' : 'size-3.5 text-text-tertiary'}
        aria-hidden
      />
      <span className="text-body-s text-text-secondary">{label}</span>
      <span className="sr-only">{ok ? 'passed' : 'not passed'}</span>
    </li>
  );
}
