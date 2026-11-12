'use client';

import { SCORE_RUBRIC } from '@nextkin/shared/models';
import { useResume } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type DragEvent } from 'react';

import { RESUME_INPUT_ACCEPT } from '@/features/onboarding/resumeUpload';
import { cn } from '@/lib/cn';
import { ATS_DISCLAIMER } from '@/features/create/createLibrary';
import { Callout } from '@/ui/Callout';
import { PdfIcon } from '@/ui/icons';
import { ArrowRight, Check, CheckCircle, File06, UploadCloud02 } from '@/ui/lineIcons';
import { textLink } from '@/ui/textLink';
import { NavInsightsIllustration } from '@/ui/illustrations';

import {
  backButton,
  ColumnHead,
  FlowFooter,
  primaryButton,
  StepHeading,
  stepCard,
} from '../jobFlow/FlowChrome';
import { useResumeUpload } from '../jobFlow/useResumeUpload';

/**
 * What the check looks at: the five parts of NextKin's rubric at their weights (V2 §7.8), the same
 * parts the result scores (redesign R6e, audit CR-13). It listed "Job title" and "Length", which
 * the score doesn't contain.
 */
const LINE: Record<string, string> = {
  keywords: 'The job’s skills, and where your roles show them',
  timeline: 'Each tool against the dates of its role',
  sections: 'Summary, skills, dated roles, education, contact',
  formatting: 'One column, standard headings, real text',
  achievements: 'Bullets with a measured result',
};

/**
 * ATS 01 (863:2), step 1: which resume to check — one made outside NextKin, dropped or browsed and
 * read on the spot, with what was read under it — and beside it what the check looks at, and that
 * the score is NextKin's own measure (V2 §7.8).
 */
export function AtsUploadStep({
  resumeId,
  onRead,
  onContinue,
}: {
  resumeId: string | undefined;
  onRead: (id: string) => void;
  onContinue: () => void;
}) {
  const upload = useResumeUpload(onRead);
  // A resume picked earlier (Back from step 2, or a reload) shows as picked, not as an empty zone
  // under an enabled Continue (CR-14).
  const kept = useResume(!upload.name && resumeId ? resumeId : '');
  const isPdf = upload.name?.toLowerCase().endsWith('.pdf') ?? true;
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) upload.pick(file);
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="ats-resume" className={stepCard}>
        <div className="px-8 pb-2 pt-8">
          <StepHeading
            id="ats-resume"
            step={1}
            of={3}
            title="Which resume should we check?"
            lede="Upload one made outside NextKin. Resumes you made here are checked as you build them."
          />
        </div>
        <div className="grid divide-y divide-border-subtle lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          <div className="flex min-w-0 flex-col gap-3.5 px-8 pb-8 pt-6 lg:col-span-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={drop}
              className={cn(
                'flex flex-wrap items-center gap-7 rounded-xl border border-dashed p-7 transition-colors duration-press ease-standard',
                dragging
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-border-brand-strong bg-surface-brand',
              )}
            >
              <Image
                src="/illustrations/flow/upload.png"
                alt=""
                width={250}
                height={168}
                className="h-auto w-36 shrink-0 rounded-lg object-contain sm:w-60"
              />
              <div className="flex min-w-0 flex-col items-start gap-2">
                <p
                  title={upload.reading ? (upload.name ?? undefined) : undefined}
                  className={cn(
                    'max-w-full text-h2 font-bold text-text-primary',
                    upload.reading && 'truncate',
                  )}
                >
                  {upload.reading ? `Reading ${upload.name}…` : 'Drag and drop your resume here'}
                </p>
                <p className="text-body-l text-text-tertiary">PDF or DOCX</p>
                <button
                  type="button"
                  disabled={upload.reading}
                  onClick={() => input.current?.click()}
                  className={cn(backButton, 'mt-1 gap-2')}
                >
                  <UploadCloud02 aria-hidden className="size-4" />
                  Browse files
                </button>
              </div>
            </div>
            {upload.name && !upload.reading && !upload.error && (
              <div className="flex items-center gap-3.5 rounded-md bg-neutral-50 px-4 py-3">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-danger-50 text-danger-600"
                >
                  {/* The file's own type (CR-16): a DOCX isn't a PDF. */}
                  {isPdf ? <PdfIcon className="size-4" /> : <File06 className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-title-l font-bold text-text-primary">{upload.name}</p>
                  {upload.summary && (
                    <p className="text-body-m text-text-tertiary">{upload.summary}</p>
                  )}
                </div>
                <CheckCircle aria-hidden className="size-4 shrink-0 text-success-600" />
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className="rounded-sm text-body-m font-semibold text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Replace
                </button>
              </div>
            )}
            {!upload.name && kept.data && (
              <div className="flex items-center gap-3.5 rounded-md bg-surface-subtle px-4 py-3">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-brand text-text-brand"
                >
                  <File06 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-title-l font-bold text-text-primary">
                    {kept.data.title}
                  </p>
                  <p className="text-body-m text-text-tertiary">Saved to Resumes</p>
                </div>
                <CheckCircle aria-hidden className="size-4 shrink-0 text-success-600" />
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className="rounded-sm text-body-m font-semibold text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Replace
                </button>
              </div>
            )}
            {upload.error && (
              <p role="alert" className="text-body-m text-danger-600">
                {upload.error}
              </p>
            )}
            <input
              ref={input}
              type="file"
              accept={RESUME_INPUT_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-label="Resume file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.pick(file);
                e.target.value = '';
              }}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-3.5 px-8 pb-8 pt-6 lg:col-span-2 lg:pr-8">
            <ColumnHead
              art={<NavInsightsIllustration className="h-auto w-11" />}
              title="What we check"
              subtitle="Against the job you pick next"
            />
            <ul className="flex flex-col gap-3">
              {SCORE_RUBRIC.map((part) => (
                <li key={part.key} className="flex gap-3">
                  <Check aria-hidden className="mt-0.5 size-4.5 shrink-0 text-text-brand" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3 text-body-l font-semibold text-text-primary">
                      {part.label}
                      <span className="shrink-0 text-body-s font-medium text-text-tertiary">
                        {part.weight} pts
                      </span>
                    </span>
                    <span className="block text-body-m text-text-tertiary">{LINE[part.key]}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Callout tone="info">
              {ATS_DISCLAIMER}{' '}
              <Link href={'/help' as Route} className={cn(textLink, 'font-semibold')}>
                How the score works
              </Link>
            </Callout>
          </div>
        </div>
      </section>
      <FlowFooter
        note={
          resumeId
            ? 'The check runs once you pick the job. Your file isn’t changed.'
            : 'Upload a resume to continue.'
        }
      >
        <Link href={'/' as Route} className={backButton}>
          Back
        </Link>
        <button
          type="button"
          onClick={onContinue}
          disabled={!resumeId || upload.reading}
          className={primaryButton}
        >
          Continue
          <ArrowRight aria-hidden className="size-4.5" />
        </button>
      </FlowFooter>
    </div>
  );
}
