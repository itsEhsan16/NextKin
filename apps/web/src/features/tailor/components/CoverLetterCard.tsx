'use client';

import {
  COVER_LETTER_TONE_LABEL,
  type CoverLetterContent,
  type CoverLetterTone,
  type Generation,
} from '@nextkin/shared/models';
import { useGeneration, useResumeContent, useStartGeneration } from '@nextkin/shared/queries';
import Link from 'next/link';
import { useState } from 'react';

import { primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { resumeHref } from '@/features/resumes/resumeHref';
import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { ArrowRight, Check, Mail01, XClose } from '@/ui/lineIcons';
import { SparkleIllustration } from '@/ui/illustrations';
import { StableLabel } from '@/ui/StableLabel';

const TONES = Object.keys(COVER_LETTER_TONE_LABEL) as CoverLetterTone[];

/**
 * W-FLOW 05b (859:335): "Cover letter for Google" inside the assistant — written from this resume
 * and the same job, in the tone picked on a segmented control (§7.10, every paragraph cites the
 * resume's facts). Once ready, "Your letter is ready" with its opening line and "Open it".
 */
export function CoverLetterCard({
  generation,
  company,
  onClose,
}: {
  generation: Generation;
  company: string;
  onClose: () => void;
}) {
  const start = useStartGeneration();
  const [tone, setTone] = useState<CoverLetterTone>('professional');
  const [runId, setRunId] = useState('');
  const letter = useGeneration(runId);
  const status = letter.data?.status;
  const letterId = status === 'ready' ? (letter.data?.resumeId ?? '') : '';
  const content = useResumeContent(letterId);
  const body =
    content.data?.kind === 'cover_letter' ? (content.data as CoverLetterContent) : undefined;
  const writing = start.isPending || (runId !== '' && status !== 'ready' && status !== 'failed');

  const write = () => {
    if (writing || !generation.resumeId) return;
    start.mutate(
      {
        kind: 'cover_letter',
        sourceResumeId: generation.resumeId,
        tone,
        ...(generation.jdId ? { jdId: generation.jdId } : {}),
        ...(generation.jobId ? { jobId: generation.jobId } : {}),
      },
      {
        onSuccess: (run) => setRunId(run.id),
        onError: () => showToast("We couldn't start the letter. Try again.", { tone: 'error' }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <section
        aria-labelledby="cover-letter"
        className="flex flex-col gap-4 rounded-lg bg-surface-brand-strong p-5"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-card text-text-brand"
          >
            <Mail01 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="cover-letter" className="text-title-l font-bold text-text-primary">
              Cover letter for {company || 'this job'}
            </h3>
            <p className="text-body-m text-text-secondary">
              Written from this resume and the job — nothing new.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-sm text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <XClose aria-hidden className="size-4" />
          </button>
        </div>
        <p className="text-body-m font-medium text-text-primary">Tone</p>
        <div role="radiogroup" aria-label="Tone" className="flex rounded-md bg-neutral-100 p-1">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tone === t}
              disabled={writing}
              onClick={() => setTone(t)}
              className={cn(
                'h-8 flex-1 rounded-sm text-body-m transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-brand-600',
                tone === t
                  ? 'bg-surface-card font-semibold text-text-primary shadow-card'
                  : 'font-medium text-text-secondary hover:text-text-primary',
              )}
            >
              {COVER_LETTER_TONE_LABEL[t]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={write}
          disabled={writing}
          className={cn(primaryButton, 'w-full')}
        >
          <SparkleIllustration aria-hidden className="h-auto w-4" />
          <StableLabel
            label={status === 'ready' ? 'Write another' : 'Write my cover letter'}
            busyLabel="Writing your letter…"
            busy={writing}
          />
        </button>
        {status === 'failed' && (
          <p role="alert" className="text-body-m text-danger-600">
            {letter.data?.error ?? 'The letter didn’t finish. Nothing was charged.'} Try again.
          </p>
        )}
      </section>

      {letterId && (
        <>
          <p className="text-body-s font-medium text-text-tertiary">After writing</p>
          <section
            aria-label="Your letter"
            className="flex flex-col gap-2.5 rounded-md bg-neutral-50 p-4"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-success-surface text-success-600"
              >
                <Check className="size-4.5" />
              </span>
              <p className="flex-1 text-body-l font-bold text-text-primary">Your letter is ready</p>
              <Link
                href={resumeHref(letterId)}
                className="flex h-8 items-center gap-1.5 rounded-full border border-border-default bg-surface-card px-3 text-body-s font-semibold text-text-primary transition-colors duration-fast ease-standard hover:border-border-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Open it
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
            {body && (
              <p className="line-clamp-2 text-body-m text-text-secondary">
                “{[body.greeting, body.paragraphs[0]].filter(Boolean).join(' ')}”
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
