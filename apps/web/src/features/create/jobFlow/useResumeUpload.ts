'use client';

import { isConsentRequired, isUnreadableFileError, useImportResume } from '@nextkin/shared/queries';
import { useState } from 'react';

import { readSummary, resumeFileProblem } from '@/features/onboarding/resumeUpload';

// Said both for a file with no text (a scan) and for one that isn't a resume (a marksheet).
const UNREADABLE =
  'We couldn’t find a resume in this file. Upload your resume as a PDF or DOCX with selectable text.';
const FAILED = 'Something went wrong reading your resume. Try again, or choose another file.';
const NEEDS_CONSENT =
  'NextKin needs your OK to use AI before it reads this. Agree, then pick the file again.';

/**
 * A resume from the computer, read the moment it is picked (toreview §110.4, §126): what it states
 * lands in Resumes as the user's own, and `onRead` gets its id so the step can pick it.
 */
export function useResumeUpload(onRead: (resumeId: string) => void) {
  const importResume = useImportResume();
  const [name, setName] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const pick = (file: File) => {
    // One file at a time: a drop while another is being read is ignored (toreview §131).
    if (importResume.isPending) return;
    const issue = resumeFileProblem(file);
    setProblem(issue);
    if (issue) return;
    setName(file.name);
    setSummary(null);
    importResume.mutate(
      {
        name: file.name,
        uri: URL.createObjectURL(file),
        size: file.size,
        ...(file.type ? { mimeType: file.type } : {}),
      },
      {
        onSuccess: ({ resume, draft }) => {
          setSummary(readSummary(draft));
          onRead(resume.id);
        },
      },
    );
  };

  const error = importResume.isError
    ? isConsentRequired(importResume.error)
      ? NEEDS_CONSENT
      : isUnreadableFileError(importResume.error)
        ? UNREADABLE
        : FAILED
    : problem;
  return { pick, name, summary, reading: importResume.isPending, error };
}
