'use client';

import type { Resume } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';

import { jobHref } from '@/features/jobs/jobHref';
import { cn } from '@/lib/cn';
import { Button, buttonClass } from '@/ui/Button';
import { Callout } from '@/ui/Callout';
import { Download01, Edit03, Send01 } from '@/ui/lineIcons';

import { resumeEditorHref } from '../resumeHref';
import { useConfirmedDownload } from '../useConfirmedDownload';
import { DownloadPrompts } from './DownloadPrompts';

// Edit leads as the one primary, Download and Use for Job beside it, the three sharing the row
// out from their own width, on one row (redesign R6a, audit RS-21: a 160px floor each pushed "Use
// for Job" onto a line of its own). Below 1440 "Use for Job" is its icon, named for screen readers
// and on hover; below 1280 Edit and Download drop their icons. Narrower still, the row wraps
// rather than cutting a label.
const EQUAL = 'flex-auto whitespace-nowrap';
const USE_FOR_JOB = 'max-2xl:size-control-lg max-2xl:flex-none max-2xl:px-0';
const PRIMARY = cn(buttonClass({ variant: 'primary', size: 'lg' }), EQUAL);
const SECONDARY = cn(buttonClass({ variant: 'secondary', size: 'lg' }), EQUAL);

/**
 * "Edit Resume", "Download" and "Use for Job" (304:3296), straight under the meta line as the
 * other detail cards put their actions: Edit leads, as the one primary (owner, 2026-11-03).
 *
 * - Edit opens the editor (toreview §124): the resume editor, or the letter editor for a letter.
 * - Download asks for the accuracy confirmation once per version, then downloads the PDF (the
 *   backend's file, or the print dialog on the mock).
 * - Use for Job opens the job the document was written for, or the Jobs page when it names none.
 */
export function ResumeActions({ resume, className }: { resume: Resume; className?: string }) {
  const download = useConfirmedDownload(resume.id);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={resumeEditorHref(resume.id)} className={PRIMARY}>
          <Edit03 aria-hidden className="size-4 shrink-0 max-xl:hidden" />
          {resume.docType === 'cover_letter' ? 'Edit Letter' : 'Edit Resume'}
        </Link>
        {/* Says it is working while the PDF is made (RS-20). */}
        <Button
          variant="secondary"
          size="lg"
          loading={download.busy}
          busyLabel="Preparing…"
          onClick={() => download.start()}
          icon={
            <Download01 aria-hidden className="size-4 shrink-0 text-text-secondary max-xl:hidden" />
          }
          className={EQUAL}
        >
          Download
        </Button>
        <Link
          href={resume.linkedJobId ? jobHref(resume.linkedJobId) : ('/jobs' as Route)}
          title="Use for Job"
          className={cn(SECONDARY, USE_FOR_JOB)}
        >
          <Send01 aria-hidden className="size-4 shrink-0 text-text-secondary" />
          <span className="max-2xl:sr-only">Use for Job</span>
        </Link>
      </div>
      <DownloadPrompts download={download} />
      {/* Why a download is blocked, and the way on (RS-24). */}
      {download.blocked && (
        <Callout tone="warning" className="mt-3">
          {download.blocked}{' '}
          <Link
            href={resumeEditorHref(resume.id)}
            className="font-semibold underline underline-offset-2"
          >
            Open in editor
          </Link>
        </Callout>
      )}
    </div>
  );
}
