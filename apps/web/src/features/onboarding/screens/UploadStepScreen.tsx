'use client';

import { isUnreadableFileError, useImportResume } from '@nextkin/shared/queries';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CollapseFade } from '@/ui/CollapseFade';

import { QuestionLayout } from '../components/QuestionLayout';
import { ReadFileRow, type ReadState } from '../components/ReadFileRow';
import { ResumeDropZone } from '../components/ResumeDropZone';
import { useOnboardingStore } from '../onboardingStore';
import { readSummary, resumeFileProblem } from '../resumeUpload';

const UNREADABLE =
  'We couldn’t read this file. A scan or a photo has no text to read — try a PDF or DOCX with selectable text.';
const FAILED = 'Something went wrong reading your resume. Try again, or choose another file.';

/**
 * ONB 04b · Upload your resume (808:2), the "Yes" from ONB 04. A file is read as soon as it is
 * picked (V2 §7.4): the resume lands in the library and Continue waits until reading is done.
 * The profile draft the parse returns is not applied: §7.4 commits nothing until the user accepts
 * it on a review, which is not drawn yet. Continue goes on to ONB 08, the starting point.
 */
export function UploadStepScreen() {
  const router = useRouter();
  const importResume = useImportResume();
  const { resumeFile, resumeSummary, answer } = useOnboardingStore();
  const [picked, setPicked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = (file: File) => {
    const issue = resumeFileProblem(file);
    setProblem(issue);
    if (issue) return;
    setPicked(file.name);
    answer({ resumeFile: undefined, resumeSummary: undefined });
    importResume.mutate(
      {
        name: file.name,
        // A blob: URL to the picked file, as Upload a JD sends one: the HTTP repository reads it
        // back and posts it to storage; the mock reads only the name and type.
        uri: URL.createObjectURL(file),
        size: file.size,
        ...(file.type ? { mimeType: file.type } : {}),
      },
      {
        onSuccess: ({ draft }) =>
          answer({ resumeFile: file.name, resumeSummary: readSummary(draft) }),
      },
    );
  };

  // A file read on an earlier visit still shows as read when the user comes back.
  const name = picked ?? resumeFile ?? null;
  const state: ReadState | null = importResume.isPending
    ? { status: 'reading' }
    : importResume.isError
      ? {
          status: 'failed',
          message: isUnreadableFileError(importResume.error) ? UNREADABLE : FAILED,
        }
      : resumeFile && resumeSummary
        ? { status: 'read', summary: resumeSummary }
        : null;

  return (
    <QuestionLayout
      eyebrow="Question 4 · Upload"
      title="Drop your resume here"
      help="We’ll read it and fill your profile. You can check everything before it’s saved."
      onContinue={() => router.push('/onboarding/done')}
      canContinue={state?.status === 'read'}
      back="/onboarding/resume"
    >
      <div className="flex flex-col gap-3">
        <ResumeDropZone onFile={pick} disabled={importResume.isPending} />
        {problem && (
          <CollapseFade axis="vertical" open animateMount>
            <p role="alert" className="text-body-s text-danger-text">
              {problem}
            </p>
          </CollapseFade>
        )}
        {name && state && <ReadFileRow key={name} name={name} state={state} />}
      </div>
    </QuestionLayout>
  );
}
