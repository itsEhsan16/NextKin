'use client';

import { useResume } from '@nextkin/shared/queries';

import { pageColumn } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { LetterEditorScreen } from './LetterEditorScreen';
import { ResumeEditorScreen } from './ResumeEditorScreen';

/** `/resumes/[id]/edit` (toreview §124): the resume editor, or the letter editor for a letter. */
export function EditorRoute({ id }: { id: string }) {
  const resume = useResume(id);
  if (resume.isError && !resume.data) {
    return (
      <div className={`${pageColumn} flex min-h-[60vh] items-center justify-center`}>
        <StateView
          title="This document isn’t here"
          message="It may have been deleted. Everything else is in Resumes."
          actionLabel="Back to Resumes"
          actionHref="/resumes"
        />
      </div>
    );
  }
  if (!resume.data) {
    return (
      <div className={`${pageColumn} py-5`} aria-busy="true">
        <Skeleton className="h-[70vh] w-full rounded-lg" />
      </div>
    );
  }
  return resume.data.docType === 'cover_letter' ? (
    <LetterEditorScreen id={id} />
  ) : (
    <ResumeEditorScreen id={id} />
  );
}
