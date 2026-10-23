'use client';

import type { Resume } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';

import { jobHref } from '@/features/jobs/jobHref';
import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { Download01, Edit03, Send01 } from '@/ui/lineIcons';

import { resumeEditorHref } from '../resumeHref';
import { useConfirmedDownload } from '../useConfirmedDownload';
import { DownloadPrompts } from './DownloadPrompts';

// One primary (Download), one secondary (Edit) and a quiet link to the job, each sized to its
// label. Narrower than the three (a tablet-width window, `toreview.md` §84), the row wraps rather
// than running out of the card.
const PRIMARY = buttonClass({ variant: 'primary', size: 'lg' });
const SECONDARY = buttonClass({ variant: 'secondary', size: 'lg' });
const QUIET = buttonClass({ variant: 'ghost', size: 'lg' });

/**
 * "Download", "Edit Resume" and "Use for Job" (304:3296), straight under the meta line as the
 * other detail cards put their actions: Download leads, as the one primary.
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
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={download.busy}
          aria-busy={download.busy}
          onClick={() => download.start()}
          className={cn(PRIMARY, 'whitespace-nowrap')}
        >
          <Download01 className="size-4 shrink-0" />
          Download
        </button>
        <Link href={resumeEditorHref(resume.id)} className={cn(SECONDARY, 'whitespace-nowrap')}>
          <Edit03 className="size-4 shrink-0 text-text-secondary" />
          {resume.docType === 'cover_letter' ? 'Edit Letter' : 'Edit Resume'}
        </Link>
        <Link
          href={resume.linkedJobId ? jobHref(resume.linkedJobId) : ('/jobs' as Route)}
          className={cn(QUIET, 'ml-auto whitespace-nowrap px-3')}
        >
          <Send01 className="size-4 shrink-0" />
          Use for Job
        </Link>
      </div>
      <DownloadPrompts download={download} />
      {download.blocked && (
        <p role="status" className="mt-2 text-body-s text-text-secondary">
          {download.blocked}
        </p>
      )}
    </div>
  );
}
