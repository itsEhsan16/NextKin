import { useMemo } from 'react';

import type { Resume } from '@/data/models';
import { usePrefetchResumeContent } from '@/data/queries';

/** How many of the top resumes are kept ready to open with no connection (toreview §145.5). */
const SAVED_AHEAD = 5;

/** Loads the bodies of the top finished resumes now, so they're on the phone before they're needed. */
export function useSaveNewestResumes(resumes: readonly Resume[] | undefined) {
  usePrefetchResumeContent(
    useMemo(
      () =>
        (resumes ?? [])
          .filter((doc) => doc.status === 'ready')
          .slice(0, SAVED_AHEAD)
          .map((doc) => doc.id),
      [resumes],
    ),
  );
}
