'use client';

import type { Route } from 'next';
import { useRef, type ReactNode } from 'react';

import { OtherWayRow } from '@/features/create/jobFlow/FlowRows';
import { useResumeUpload } from '@/features/create/jobFlow/useResumeUpload';
import { RESUME_INPUT_ACCEPT } from '@/features/onboarding/resumeUpload';
import { Plus, Stars02, Upload01, User01, iconSize } from '@/ui/lineIcons';
import { Spinner } from '@/ui/Spinner';

const Tile = ({ children }: { children: ReactNode }) => (
  <span className="flex size-9 items-center justify-center rounded-md bg-brand-50 text-text-brand">
    {children}
  </span>
);

/**
 * W-FLOW 02's "Other ways to start" (redesigned in toreview §150): upload a resume, start from a
 * blank one, or build from the profile, then a tip. A way the flow has no place for isn't offered.
 */
export function OtherWays({
  onUploaded,
  blankHref,
  profileHref,
}: {
  onUploaded: (resumeId: string) => void;
  blankHref?: Route;
  profileHref?: Route;
}) {
  const upload = useResumeUpload(onUploaded);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h2 className="text-title-l font-bold text-text-primary">Other ways to start</h2>
      <OtherWayRow
        art={
          <Tile>
            {upload.reading ? <Spinner className="size-4" /> : <Upload01 className={iconSize.md} />}
          </Tile>
        }
        title={upload.reading ? `Reading ${upload.name ?? 'your resume'}…` : 'Upload a resume'}
        line="Use a resume from your computer (PDF or DOCX)."
        onClick={() => !upload.reading && input.current?.click()}
      />
      {upload.error && (
        <p role="alert" className="text-body-m text-danger-600">
          {upload.error}
        </p>
      )}
      {blankHref && (
        <OtherWayRow
          art={
            <Tile>
              <Plus className={iconSize.md} />
            </Tile>
          }
          title="Start from a blank resume"
          line="Create a new resume with AI guidance."
          href={blankHref}
        />
      )}
      {profileHref && (
        <OtherWayRow
          art={
            <Tile>
              <User01 className={iconSize.md} />
            </Tile>
          }
          title="Use my profile"
          line="Build from your saved work experience, education, and skills."
          href={profileHref}
        />
      )}
      <div className="flex flex-col gap-1.5 rounded-lg bg-surface-brand px-4 py-3.5">
        <p className="flex items-center gap-1.5 text-body-m font-semibold text-text-brand">
          <Stars02 aria-hidden className={iconSize.sm} />
          Tip
        </p>
        <p className="text-body-m text-text-secondary">
          Choose the resume that best matches the job, or upload a new one if needed. Your original
          stays as it is: we make a new version.
        </p>
      </div>
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
