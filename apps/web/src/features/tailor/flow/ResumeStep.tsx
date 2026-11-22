'use client';

import type { Job, Resume } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import { useRef } from 'react';

import {
  backButton,
  FlowFooter,
  primaryButton,
  StepHeading,
  stepCard,
  stepShell,
  TrustNote,
} from '@/features/create/jobFlow/FlowChrome';
import { useResumeUpload } from '@/features/create/jobFlow/useResumeUpload';
import { RESUME_INPUT_ACCEPT } from '@/features/onboarding/resumeUpload';
import { ArrowRight } from '@/ui/lineIcons';
import { JdArtUploadFileIllustration } from '@/ui/illustrations';

import { OtherWays } from './OtherWays';
import { ResumePicker } from './ResumePicker';
import { ResumeDropArea } from '@/features/create/components/ResumeDropArea';

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
  copy?: { title: string; lede: string; note?: string };
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
    <div className={stepShell}>
      <section aria-labelledby="resume-step" className={stepCard}>
        <div className="px-8 pb-2 pt-8">
          <StepHeading
            id="resume-step"
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
  // The one drop zone every upload uses (owner's §221 design, toreview §257).
  return <ResumeDropArea className="min-h-56" onUploaded={({ resumeId }) => onRead(resumeId)} />;
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
