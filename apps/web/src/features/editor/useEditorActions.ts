'use client';

import { documentProblems } from '@nextkin/shared/scoring/resumeDocumentCheck';
import { useMemo, useState } from 'react';

import { useConfirmedDownload } from '@/features/resumes/useConfirmedDownload';
import { showToast } from '@/lib/toast';

import type { ResumeEditor } from './useResumeEditor';

/**
 * What the editor's buttons do beyond typing (toreview §124).
 *
 * - Download checks the page first (a name, something in it, every entry named), saves the latest
 *   change so the file is what is on screen, then runs the usual export with its accuracy
 *   confirmation.
 *
 * Duplicating and deleting live on the resume's menu in Resumes (EDIT 01 draws no menu here).
 */
export function useEditorActions(id: string, editor: ResumeEditor) {
  const download = useConfirmedDownload(id);
  const [checking, setChecking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const problems = useMemo(() => (editor.doc ? documentProblems(editor.doc) : []), [editor.doc]);

  const startDownload = async () => {
    if (problems.length) {
      setChecking(true);
      return;
    }
    if (editor.doc?.pendingReview) {
      showToast(
        'Some details were guessed for you. Check them in the mobile app’s review before you download.',
        { tone: 'info' },
      );
      return;
    }
    if (editor.status === 'conflict') {
      showToast(
        'Sort out the change made elsewhere first, so the download is the version you mean.',
        { tone: 'info' },
      );
      return;
    }
    setPreparing(true);
    const saved = await editor.saveNow();
    setPreparing(false);
    if (!saved) {
      showToast(
        'Your latest change hasn’t saved yet, so the PDF would be out of date. Try again in a moment.',
        { tone: 'error' },
      );
      return;
    }
    download.start();
  };

  return {
    problems,
    checking,
    setChecking,
    download,
    downloading: preparing || download.busy,
    startDownload,
  };
}
