import { isRestored, restoreLine, type LineRestore } from '@nextkin/shared/scoring/lineRestore';
import { useCallback, useState } from 'react';

import { useFetchLatestResumeDocument, useSaveResumeDocument } from '@/data/queries';
import { showAppToast } from '@/ui/Toast';

export type RestoreState = 'saving' | 'done';

/**
 * Restore for a line the tailor's review took out (§202): reads the newest copy of the resume,
 * puts the line back where it sat and saves it as an ordinary edit (a new version). A line that is
 * already back counts as done; one whose role has since been deleted can't go back, and says so.
 */
export function useRestoreLine(resumeId: string) {
  const fetchLatest = useFetchLatestResumeDocument(resumeId);
  const save = useSaveResumeDocument(resumeId);
  const [states, setStates] = useState<Record<string, RestoreState>>({});
  const set = (key: string, state: RestoreState | null) =>
    setStates((now) => {
      const next = { ...now };
      if (state) next[key] = state;
      else delete next[key];
      return next;
    });

  const restore = useCallback(
    async (key: string, line: LineRestore) => {
      set(key, 'saving');
      try {
        const doc = await fetchLatest();
        if (!isRestored(doc, line)) {
          const write = restoreLine(doc, line);
          if (!write) {
            set(key, null);
            showAppToast('That part of the resume is gone, so the line can’t go back.', 'error');
            return;
          }
          await save.mutateAsync({ write, baseRevision: doc.revision });
        }
        set(key, 'done');
        showAppToast('Back on your resume');
      } catch {
        set(key, null);
        showAppToast('That didn’t save. Try again.', 'error');
      }
    },
    [fetchLatest, save],
  );

  return { states, restore };
}
