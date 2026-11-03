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

// Edit leads as the one primary, Download and Use for Job beside it, the three sharing the row
// equally. Too narrow for three (a tablet-width window, `toreview.md` §84), the row wraps rather
// than running out of the card.
const EQUAL = 'min-w-40 flex-1 whitespace-nowrap';
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
      <div className="flex flex-wrap items-center gap-3">
        <Link href={resumeEditorHref(resume.id)} className={PRIMARY}>
          <Edit03 className="size-4 shrink-0" />
          {resume.docType === 'cover_letter' ? 'Edit Letter' : 'Edit Resume'}
        </Link>
        <button
          type="button"
          disabled={download.busy}
          aria-busy={download.busy}
          onClick={() => download.start()}
          className={SECONDARY}
        >
          <Download01 className="size-4 shrink-0 text-text-secondary" />
          Download
        </button>
        <Link
          href={resume.linkedJobId ? jobHref(resume.linkedJobId) : ('/jobs' as Route)}
          className={SECONDARY}
        >
          <Send01 className="size-4 shrink-0 text-text-secondary" />
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
