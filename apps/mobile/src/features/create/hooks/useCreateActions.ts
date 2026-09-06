import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { UpgradeReason } from '@/features/billing';

/**
 * Every navigation the create flow makes (V2 §7.5 → §7.6, and the §7.4 / §7.9 / §7.10 intakes).
 * Routing lives here rather than in the screens so a component never holds a pathname, exactly as
 * `useJobsActions` does it.
 */
export function useCreateActions() {
  const router = useRouter();

  const openUpgrade = useCallback(
    (reason?: UpgradeReason) =>
      router.push(reason ? { pathname: '/upgrade', params: { reason } } : '/upgrade'),
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
      /** §13.5: a gated control names the limit it hit rather than opening a generic pitch. */
      openUpgrade,
      openUpload: () => router.push('/create/upload'),
      /** The parsed rows waiting to be accepted; the draft itself travels in `useImportStore`. */
      openUploadReview: () => router.replace('/create/upload-review'),
      openTailor: () => router.push('/create/tailor'),
      openCoverLetter: () => router.push('/create/cover-letter'),
      openAtsCheck: () => router.push('/create/ats-check'),
      /** A finished run has its own screen; a started one replaces the intake behind it. */
      openGeneration: (generationId: string) =>
        router.replace({ pathname: '/generations/[id]', params: { id: generationId } }),
      openDocument: (resumeId: string) =>
        router.replace({ pathname: '/resumes/[id]', params: { id: resumeId } }),
      openResumes: () => router.navigate('/(tabs)/resumes'),
      openProfileSkills: () => router.push('/profile/skills'),
    }),
    [openUpgrade, router],
  );
}
