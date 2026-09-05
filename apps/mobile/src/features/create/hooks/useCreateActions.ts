import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { PlaceholderKey } from '@/features/placeholders';

/**
 * Every navigation the create flow makes (V2 §7.5 → §7.6). Routing lives here rather than in the
 * screens so a component never holds a pathname, exactly as `useJobsActions` does it — including
 * the placeholder push for the flows Figma has not drawn yet (plan §8).
 */
export function useCreateActions() {
  const router = useRouter();

  const placeholder = useCallback(
    (screen: PlaceholderKey) =>
      router.push({ pathname: '/placeholder/[screen]', params: { screen } }),
    [router],
  );

  return useMemo(
    () => ({
      goBack: () => router.back(),
      /**
       * The review screen reads the extraction back from its own cache, so only the ids travel.
       * The base resume rides along because the review screen is where generation starts and it
       * must not have to guess which document the intake picked.
       */
      openJdReview: (draftId: string, baseResumeId?: string) =>
        router.push({
          pathname: '/create/jd-review',
          params: baseResumeId ? { draftId, baseResumeId } : { draftId },
        }),
      // Undesigned flows this screen links out to.
      openUpgrade: () => placeholder('upgrade'),
      openUpload: () => placeholder('upload-resume'),
    }),
    [placeholder, router],
  );
}
