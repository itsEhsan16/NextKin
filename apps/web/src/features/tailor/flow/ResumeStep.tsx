'use client';

import type { Job, Resume } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import { useRef, useState, type DragEvent } from 'react';

import {
  backButton,
  FlowFooter,
  primaryButton,
  StepHeading,
  stepCard,
  TrustNote,
} from '@/features/create/jobFlow/FlowChrome';
import { useResumeUpload } from '@/features/create/jobFlow/useResumeUpload';
import { RESUME_INPUT_ACCEPT } from '@/features/onboarding/resumeUpload';
import { cn } from '@/lib/cn';
import { AiLoader } from '@/ui/AiLoader';
import { Button } from '@/ui/Button';
import { ArrowRight, UploadCloud02, iconSize } from '@/ui/lineIcons';
import { Spinner } from '@/ui/Spinner';
import { JdArtUploadFileIllustration } from '@/ui/illustrations';

import { OtherWays } from './OtherWays';
import { ResumePicker } from './ResumePicker';

/**
 * W-FLOW 02 (849:318, redesigned in toreview §150), step 2: which resume to start from — yours on
 * the left with a search, a sort and pages, the base picked first; on the right other ways to start.
 * The original is never changed; tailoring makes a new version.
 */
export function ResumeStep({
  job,
  resumes,
  loading,
  failed,
  onRetry,
  value,
  onPick,
  onContinue,
  backHref,
  copy,
  blankHref,
  profileHref,
}: {
  /** Another flow's words for the same step: the cover letter's, the ATS check's. */
  copy?: { title: string; lede: string; of: number; note?: string };
  job: Job;
  resumes: readonly Resume[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  value: string | undefined;
  onPick: (resumeId: string) => void;
  onContinue: () => void;
  backHref: Route;
  /** "Start from a blank resume": Zero Resume for this job. */
  blankHref?: Route;
  /** "Use my profile": a build from the profile for this job. */
  profileHref?: Route;
}) {
  const company = job.company.trim();
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="resume-step" className={stepCard}>
        <div className="px-8 pb-2 pt-8">
          <StepHeading
            id="resume-step"
            step={2}
            of={copy?.of ?? 3}
            title={copy?.title ?? 'Choose a starting resume'}
            lede={
              copy?.lede ??
              `Select a resume to use as a base. We’ll tailor it for the ${job.title} role${company ? ` at ${company}` : ''}.`
            }
          />
        </div>
        <div className="grid divide-y divide-border-subtle lg:grid-cols-[minmax(0,13fr)_minmax(0,6fr)] lg:divide-x lg:divide-y-0">
          <div className="min-w-0 px-8 pb-8 pt-6">
            <ResumePicker
              resumes={resumes}
              loading={loading}
              failed={failed}
              onRetry={onRetry}
              value={value}
              onPick={onPick}
            />
          </div>
          <div className="min-w-0 px-8 pb-8 pt-6">
            <OtherWays
              onUploaded={onPick}
              {...(blankHref ? { blankHref } : {})}
              {...(profileHref ? { profileHref } : {})}
            />
          </div>
        </div>
      </section>

      <FlowFooter note={copy?.note ?? <TrustNote />}>
        <Link href={backHref} className={backButton}>
          Back
        </Link>
        <button type="button" onClick={onContinue} disabled={!value} className={primaryButton}>
          Continue
          <ArrowRight aria-hidden className="size-4.5" />
        </button>
      </FlowFooter>
    </div>
  );
}

/** W-FLOW 02's drop zone (849:606): drag a file here or browse; reading, then picked. */
export function DropZone({ onRead }: { onRead: (resumeId: string) => void }) {
  const upload = useResumeUpload(onRead);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) upload.pick(file);
  };
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!upload.reading) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      aria-busy={upload.reading || undefined}
      className={cn(
        'flex min-h-56 min-w-0 flex-1 flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed px-5 py-6 text-center transition-colors duration-press ease-standard',
        dragging ? 'border-brand-600 bg-brand-50' : 'border-border-brand-strong bg-surface-brand',
      )}
    >
      <span
        aria-hidden
        className="flex size-13 items-center justify-center rounded-full bg-surface-card text-text-brand"
      >
        {upload.reading ? (
          <Spinner className="size-5" />
        ) : (
          <UploadCloud02 className={iconSize.md} />
        )}
      </span>
      <div className="flex w-full min-w-0 flex-col items-center gap-0.5">
        <p className="text-body-l font-semibold text-text-primary">
          {upload.reading
            ? 'Reading your resume…'
            : upload.name && !upload.error
              ? 'Saved to Resumes and picked'
              : 'Drag and drop your resume here'}
        </p>
        {upload.name && (upload.reading || !upload.error) && (
          <p title={upload.name} className="max-w-full truncate text-body-m text-text-secondary">
            {upload.name}
          </p>
        )}
        {upload.reading && <AiLoader variant="loading-line" silent className="mt-1.5 w-40" />}
      </div>
      <Button
        variant="secondary"
        disabled={upload.reading}
        icon={<UploadCloud02 aria-hidden className={cn(iconSize.sm, 'text-text-brand')} />}
        onClick={() => input.current?.click()}
      >
        Upload a file
      </Button>
      <p className="text-body-s font-medium text-text-tertiary">PDF or DOCX</p>
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
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.pick(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}

/** W-FLOW 03a's "Upload another resume" (852:349): a dashed row, read on pick, then chosen. */
export function UploadRow({ onRead }: { onRead: (resumeId: string) => void }) {
  const upload = useResumeUpload(onRead);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-2.5 flex flex-col gap-1.5">
      <button
        type="button"
        disabled={upload.reading}
        onClick={() => input.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) upload.pick(file);
        }}
        className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border-brand-strong bg-surface-brand px-4 py-3 text-left transition-colors duration-press ease-standard hover:border-brand-600 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <JdArtUploadFileIllustration aria-hidden className="h-auto w-7 shrink-0" />
        <span className="min-w-0">
          <span
            title={upload.reading ? (upload.name ?? undefined) : undefined}
            className="block truncate text-title-l font-bold text-text-primary"
          >
            {upload.reading ? `Reading ${upload.name}…` : 'Upload another resume'}
          </span>
          <span className="block text-body-m text-text-tertiary">
            PDF or DOCX · drop it here or browse
          </span>
        </span>
      </button>
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
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.pick(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}
