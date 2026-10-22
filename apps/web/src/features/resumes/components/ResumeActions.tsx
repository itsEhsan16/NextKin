'use client';

import type { Resume } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';

import { jobHref } from '@/features/jobs/jobHref';
import { cn } from '@/lib/cn';
import { brandButton } from '@/ui/brandButton';
import { Download01, Edit03, Send01 } from '@/ui/lineIcons';
import { outlineButton } from '@/ui/outlineButton';

import { resumeEditorHref } from '../resumeHref';
import { useConfirmedDownload } from '../useConfirmedDownload';
import { DownloadPrompts } from './DownloadPrompts';

// Equal thirds while the labels fit; below that each keeps its label on one line and the three
// share what is left, which is what a 1280 window with the sidebar open needs. Narrower still
// (a tablet-width window, `toreview.md` §84), the row wraps rather than running out of the card.
const SIZE =
  'h-control-lg flex-1 gap-2 whitespace-nowrap rounded-md px-2 text-body-l font-semibold';

/**
 * "Edit Resume", "Download" and "Use for Job" (304:3296), straight under the meta line as the
 * other detail cards put their actions.
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
      <div className="flex flex-wrap gap-3">
        <Link href={resumeEditorHref(resume.id)} className={cn(brandButton, SIZE)}>
          <Edit03 className="size-4 shrink-0" />
          {resume.docType === 'cover_letter' ? 'Edit Letter' : 'Edit Resume'}
        </Link>
        <button
          type="button"
          disabled={download.busy}
          aria-busy={download.busy}
          onClick={() => download.start()}
          className={cn(outlineButton, SIZE)}
        >
          <Download01 className="size-4 shrink-0 text-text-secondary" />
          Download
        </button>
        <Link
          href={resume.linkedJobId ? jobHref(resume.linkedJobId) : ('/jobs' as Route)}
          className={cn(outlineButton, SIZE)}
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
