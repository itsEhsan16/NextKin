import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { PlaceholderKey } from '@/features/placeholders';

/** Every tap target on the generation progress screen resolves here (V2 §7.6). */
export function useGenerationsActions() {
  const router = useRouter();

  const placeholder = useCallback(
    (screen: PlaceholderKey) =>
      router.push({ pathname: '/placeholder/[screen]', params: { screen } }),
    [router],
  );

  return useMemo(
    () => ({
      goBack: () => router.back(),
      /** The finished run's score panel — the designed per-document screen (RESUMES 04). */
      openScore: (resumeId: string) =>
        router.push({ pathname: '/resumes/[id]/score', params: { id: resumeId } }),
      // The document editor is undesigned; Phase 9C replaces this placeholder.
      openDocument: () => placeholder('resume-detail'),
      /** Where an id that no longer resolves sends the user: the library that outlived it. */
      openResumes: () => router.navigate('/(tabs)/resumes'),
      /**
       * A failed run is usually a bad input, not a bad server, so the second way out is the JD
       * the run was tailored to (V2 §7.5 → §7.6) rather than another attempt at the same thing.
       */
      editJd: (jdId: string) =>
        router.push({ pathname: '/create/jd-review', params: { draftId: jdId } }),
      /**
       * The same escape hatch for a run that has no saved draft — only the job it was tailored
       * to. The tailor intake opens prefilled from that listing, so the description is still
       * what gets fixed.
       */
      editJobDescription: (jobId: string) =>
        router.push({ pathname: '/create/tailor', params: { jobId } }),
    }),
    [placeholder, router],
  );
}
