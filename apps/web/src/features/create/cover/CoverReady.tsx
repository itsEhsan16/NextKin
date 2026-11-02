'use client';

import type { CoverLetterContent, CoverLetterTone, Generation, Job } from '@nextkin/shared/models';
import {
  useCurrentUser,
  useProfile,
  useResume,
  useResumeContent,
  useStartGeneration,
  useSubscription,
} from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';

import { LetterPage } from '@/features/editor/preview/LetterPage';
import { DownloadPrompts } from '@/features/resumes/components/DownloadPrompts';
import { resumeEditorHref } from '@/features/resumes/resumeHref';
import { useConfirmedDownload } from '@/features/resumes/useConfirmedDownload';
import { JobLogoTile } from '@/features/tailor/flow/EntityRow';
import { cn } from '@/lib/cn';
import { Callout } from '@/ui/Callout';
import { showToast } from '@/lib/toast';
import { iconButton } from '@/ui/iconButton';
import { BriefcaseIcon } from '@/ui/icons';
import { Check, ChevronRight, Download01, Edit03, File06 } from '@/ui/lineIcons';
import { NavDocumentsIllustration } from '@/ui/illustrations';
import { Skeleton } from '@/ui/Skeleton';
import { StableLabel } from '@/ui/StableLabel';

import { coverAllowance } from '../createLibrary';
import { backButton, primaryButton, stepCard } from '../jobFlow/FlowChrome';
import { TONE_COPY, TONES } from './CoverSteps';

/**
 * COVER 03 (862:485): your letter is ready — the page itself on the left, and beside it "Try
 * another tone" (a fresh letter from the same resume), what it was built from, and that every claim
 * is already on the resume. Edit letter and Download PDF lead the header.
 */
export function CoverReady({
  generation,
  job,
  backHref,
  onStarted,
}: {
  generation: Generation;
  job: Job;
  backHref: Route;
  onStarted: (runId: string) => void;
}) {
  const letterId = generation.resumeId ?? '';
  const user = useCurrentUser();
  const profile = useProfile();
  const source = useResume(generation.sourceResumeId ?? '');
  const content = useResumeContent(letterId);
  const download = useConfirmedDownload(letterId);
  const subscription = useSubscription();
  const again = useStartGeneration();
  const spent = coverAllowance(subscription.data?.usage).spent;
  const tone = generation.tone ?? 'professional';
  const letter =
    content.data?.kind === 'cover_letter' ? (content.data as CoverLetterContent) : undefined;
  const name = user.data ? `${user.data.firstName} ${user.data.lastName}` : '';
  const contact = [profile.data?.location, user.data?.email].filter(Boolean).join(' · ');

  const retone = (next: CoverLetterTone) => {
    if (!generation.sourceResumeId || again.isPending || spent) return;
    again.mutate(
      {
        kind: 'cover_letter',
        sourceResumeId: generation.sourceResumeId,
        tone: next,
        ...(generation.jobId ? { jobId: generation.jobId } : {}),
        ...(generation.jdId ? { jdId: generation.jdId } : {}),
      },
      {
        onSuccess: (run) => onStarted(run.id),
        onError: () => showToast("We couldn't start another letter. Try again.", { tone: 'error' }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          aria-label="Back"
          className={cn(
            iconButton,
            'size-9 rounded-full border border-border-default bg-surface-card',
          )}
        >
          <ChevronRight aria-hidden className="size-4.5 rotate-180 text-text-primary" />
        </Link>
        <JobLogoTile job={job} />
        <div className="min-w-0">
          <p className="truncate text-caption-m text-text-tertiary">
            Cover letter · {job.company ? `${job.title} · ${job.company}` : job.title}
          </p>
          <h1 className="text-title-l font-bold text-text-primary">Your letter is ready</h1>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-success-surface px-2.5 py-0.5 text-caption-m font-semibold text-success-text">
          <Check aria-hidden className="size-4" />
          Saved to Resumes
        </span>
        <span className="flex-1" />
        <Link href={resumeEditorHref(letterId)} className={backButton}>
          <Edit03 aria-hidden className="mr-2 size-4" />
          Edit letter
        </Link>
        <button
          type="button"
          onClick={() => download.start()}
          disabled={!letter || download.busy}
          className={primaryButton}
        >
          <Download01 aria-hidden className="size-4" />
          <StableLabel label="Download PDF" busyLabel="Preparing PDF…" busy={download.busy} />
        </button>
      </header>
      {download.blocked && (
        <p role="status" className="text-body-m text-text-secondary">
          {download.blocked}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <section
          aria-label="Your cover letter"
          className={cn(stepCard, 'bg-neutral-100 px-6 pt-6 lg:col-span-2')}
        >
          <div className="mx-auto max-w-2xl bg-surface-card px-14 pb-16 pt-16 shadow-popover">
            {letter ? (
              <LetterPage
                name={name}
                contact={contact}
                date={new Date(generation.updatedAt)}
                greeting={letter.greeting}
                paragraphs={letter.paragraphs}
                signoff={letter.signoff}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}
          </div>
        </section>

        <aside className={cn(stepCard, 'flex flex-col gap-3.5 p-5 lg:sticky lg:top-6')}>
          <div className="flex items-center gap-3">
            <NavDocumentsIllustration aria-hidden className="h-auto w-10" />
            <div>
              <h2 className="text-h2 font-bold text-text-primary">Try another tone</h2>
              <p className="text-body-m text-text-secondary">Rewrites the whole letter</p>
            </div>
          </div>
          <ul className="flex flex-col gap-3">
            {TONES.map((t) => {
              const current = t === tone;
              return (
                <li
                  key={t}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-4 py-3',
                    current
                      ? 'border-brand-600 bg-surface-brand ring-1 ring-brand-600'
                      : 'border-border-default bg-surface-card',
                  )}
                >
                  <span className="text-body-l font-semibold text-text-primary">
                    {TONE_COPY[t].label}
                  </span>
                  {current ? (
                    <span className="rounded-full border border-border-brand-strong bg-surface-card px-2.5 py-0.5 text-caption-m font-semibold text-text-brand">
                      Current
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={spent || again.isPending}
                      onClick={() => retone(t)}
                      className="rounded-sm text-body-m font-semibold text-text-brand hover:underline disabled:text-text-tertiary disabled:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    >
                      Rewrite
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {spent && (
            <p className="text-body-s text-text-tertiary">
              This month’s cover letters are used. Pro raises the monthly cap.
            </p>
          )}
          <div className="flex flex-col gap-2.5 pt-2">
            <h3 className="text-body-l font-bold text-text-primary">Built from</h3>
            <p className="flex items-center gap-2.5 text-body-l text-text-secondary">
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-md bg-neutral-100 text-text-tertiary"
              >
                <BriefcaseIcon className="size-3.5" />
              </span>
              {job.company ? `${job.title} · ${job.company}` : job.title}
            </p>
            {source.data && (
              <p className="flex items-center gap-2.5 text-body-l text-text-secondary">
                <span
                  aria-hidden
                  className="flex size-7 items-center justify-center rounded-md bg-neutral-100 text-text-tertiary"
                >
                  <File06 className="size-4.5" />
                </span>
                {source.data.title} (resume)
              </p>
            )}
          </div>
          <Callout>Every claim in the letter is already on your resume.</Callout>
        </aside>
      </div>
      <DownloadPrompts download={download} />
    </div>
  );
}
