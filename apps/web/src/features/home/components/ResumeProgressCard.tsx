import { resumeHref } from '@/features/resumes/resumeHref';
import type { Route } from 'next';
import Link from 'next/link';

import { atsBandFor, type Resume } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { formatRelativeTime } from '@/lib/format';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/ProgressBar';
import { ScoreRing, ringToneFor } from '@/ui/ScoreRing';
import { SectionHeader } from '@/ui/SectionHeader';
import { Skeleton } from '@/ui/Skeleton';
import { SkeletonCircle, SkeletonLines } from '@/ui/SkeletonShapes';
import { StateView } from '@/ui/StateView';
import { CheckCircle, File06, MinusCircle } from '@/ui/lineIcons';

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
        // "View all" goes to all of them (HM-11); the row itself opens this one.
        actionHref={resume ? ('/resumes' as Route) : undefined}
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
          actionLabel="Build a resume"
          actionHref={'/create/build' as Route}
        />
      )}

      {status === 'success' && resume && (
        <>
          <div className={cn('mt-4 flex items-center gap-3', reveal && 'animate-reveal')}>
            {/* A document glyph on the brand tint, not a grey block that read as a failed image
                (HM-12). */}
            <Link
              href={resumeHref(resume.id)}
              aria-label={`Open ${resume.title}`}
              className="flex h-[76px] w-16 shrink-0 items-center justify-center rounded-md bg-surface-brand text-text-brand transition-colors duration-press ease-standard hover:bg-surface-brand-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <File06 aria-hidden className="size-6" />
            </Link>
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
              <ScoreRing
                score={resume.atsScore}
                label="ATS Score"
                sweep={reveal}
                tone={ringToneFor(atsBandFor(resume.atsScore))}
              />
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

/** Passed and not passed differ in shape, not only in colour (HM-10). */
function ValidationPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex h-8 items-center gap-1.5 rounded-full bg-surface-subtle px-3">
      {ok ? (
        <CheckCircle aria-hidden className="size-3.5 text-success-text" />
      ) : (
        <MinusCircle aria-hidden className="size-3.5 text-text-tertiary" />
      )}
      <span className={ok ? 'text-body-s text-text-secondary' : 'text-body-s text-text-tertiary'}>
        {label}
      </span>
      <span className="sr-only">{ok ? 'passed' : 'not passed'}</span>
    </li>
  );
}
