'use client';

import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/Dialog';
import type { Resume } from '@nextkin/shared/models';
import type { QueryPhase } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';

import { backButton, primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { DocTile, Radio, resumeLine, rowSurface } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { formatUpdated } from '@/lib/format';
import { outlineButton } from '@/ui/outlineButton';
import { Skeleton } from '@/ui/Skeleton';

/** "Base resume · Updated 2 days ago", "For Google · Updated last week", as mobile's sheet words it. */
export function resumeMeta(resume: Resume): string {
  const lead = resume.isBase
    ? 'Base resume'
    : resume.targetCompany
      ? `For ${resume.targetCompany}`
      : undefined;
  return [lead, formatUpdated(resume.updatedAt)].filter(Boolean).join(' · ');
}

export type TailorResumeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the run aims at, for the line under the title. */
  target: { title: string; company?: string };
  /** The resumes it can start from: `tailorableResumes`, base first. */
  resumes: readonly Resume[];
  /**
   * The list's query (`queryPhase`). While it loads the rows wait as skeletons, and a failed read
   * offers a retry: neither is ever shown as "no resume yet".
   */
  phase?: QueryPhase;
  onRetry?: () => void;
  /** The pre-pick: the resume already in use, else the base. */
  value?: string;
  onContinue: (resumeId: string) => void;
  /** "Upload a resume from your computer" (§110.4), under the list; `pick` selects what it read. */
  upload?: (pick: (resumeId: string) => void) => ReactNode;
};

/**
 * "Which resume should we tailor?" (toreview §110): a centred dialog over the job page, before the
 * comparison. Spec-derived from mobile's TAILOR 01 sheet (606:2); no web board draws it, so it is
 * the web app's own card, buttons and rows. The list is a radio group, so the arrow keys move the
 * pick, and the base resume is picked first.
 */
export function TailorResumeDialog({
  open,
  onOpenChange,
  target,
  resumes,
  phase = 'success',
  onRetry,
  value,
  onContinue,
  upload,
}: TailorResumeDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      className="max-h-[min(640px,calc(100dvh-2rem))]"
    >
      <div className="px-7 pb-4 pt-7">
        <DialogTitle className="text-h2 font-bold text-text-primary">
          Which resume should we tailor?
        </DialogTitle>
        <DialogDescription className="mt-1 text-body-l text-text-secondary">
          For {target.title}
          {target.company ? ` · ${target.company}` : ''}. Your original stays as it is.
        </DialogDescription>
      </div>
      {/* The content mounts with each opening, so the pick starts from the resume in use. */}
      <DialogBody
        resumes={resumes}
        phase={phase}
        onRetry={onRetry}
        value={value}
        onContinue={onContinue}
        upload={upload}
      />
    </Dialog>
  );
}

function DialogBody({
  resumes,
  phase,
  onRetry,
  value,
  onContinue,
  upload,
}: Pick<
  TailorResumeDialogProps,
  'resumes' | 'phase' | 'onRetry' | 'value' | 'onContinue' | 'upload'
>) {
  const [choice, setChoice] = useState<string | undefined>(undefined);
  const name = useId();
  const picked = phase === 'success' ? (choice ?? value ?? resumes[0]?.id) : undefined;
  const setPicked = setChoice;
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {phase === 'pending' ? (
          <div role="status" aria-label="Loading your resumes" className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        ) : phase === 'error' ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-neutral-50 px-4 py-3 text-body-m text-text-secondary"
          >
            We couldn’t load your resumes.
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className={cn(
                  outlineButton,
                  'h-control-md rounded-md px-3 text-body-s font-semibold',
                )}
              >
                Try again
              </button>
            )}
          </div>
        ) : resumes.length > 0 ? (
          <div role="radiogroup" aria-label="Your resumes" className="flex flex-col gap-2.5">
            {resumes.map((resume) => {
              const checked = picked === resume.id;
              return (
                <label
                  key={resume.id}
                  className={cn(
                    rowSurface(checked),
                    'flex cursor-pointer items-center gap-3.5 px-4 py-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600',
                  )}
                >
                  <input
                    type="radio"
                    name={name}
                    value={resume.id}
                    checked={checked}
                    onChange={() => setPicked(resume.id)}
                    className="sr-only"
                  />
                  <Radio on={checked} />
                  <DocTile />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-title-l font-bold text-text-primary">
                        {resume.title}
                      </span>
                      {resume.isBase && (
                        <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-caption-m font-semibold text-text-brand">
                          Base resume
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-body-m text-text-tertiary">
                      {resumeLine(resume)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="rounded-md bg-neutral-50 px-4 py-3 text-body-m text-text-secondary">
            You don’t have a resume on NextKin yet.{' '}
            {upload ? (
              'Upload one below.'
            ) : (
              <Link
                href={'/resumes' as Route}
                className="font-semibold text-text-brand hover:opacity-80"
              >
                Create one in Resumes
              </Link>
            )}
          </p>
        )}
        {upload && <div className="mt-3">{upload(setPicked)}</div>}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-default px-5 py-4">
        <p className="mr-auto text-body-m text-text-tertiary">
          We compare again with the one you pick.
        </p>
        <DialogClose className={backButton}>Cancel</DialogClose>
        <button
          type="button"
          disabled={!picked}
          onClick={() => picked && onContinue(picked)}
          className={primaryButton}
        >
          Use this resume
        </button>
      </div>
    </>
  );
}
