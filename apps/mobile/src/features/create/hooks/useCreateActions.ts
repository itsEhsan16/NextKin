import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { UpgradeReason } from '@/features/billing';

/** What the Customize screen is opened on: a listing or a read JD, and maybe the resume. */
export type CustomizeTarget = { jobId?: string; jdId?: string; resumeId?: string };

/** The route params for a target, with nothing undefined in them. */
export const customizeParams = ({ jobId, jdId, resumeId }: CustomizeTarget) => ({
  ...(jobId ? { jobId } : {}),
  ...(jdId ? { jdId } : {}),
  ...(resumeId ? { resumeId } : {}),
});

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
       * The one Customize screen (toreview §114) for a listing or a JD that was just read. The
       * intake replaces itself with it: Back from Customize leaves the flow, and "Details" is
       * where the description is corrected.
       */
      openCustomize: (target: CustomizeTarget, options: { replace?: boolean } = {}) => {
        const href = { pathname: '/create/tailor' as const, params: customizeParams(target) };
        if (options.replace) router.replace(href);
        else router.push(href);
      },
      /** "Details": the JD as read, to correct and come back (never a step in front of a run). */
      openJobDetails: (draftId: string) =>
        router.push({ pathname: '/create/jd-review', params: { draftId } }),
      /** No resume, a profile with roles: BUILD 04b for this job, then its run. */
      openBuildCompare: ({ jobId, jdId }: Omit<CustomizeTarget, 'resumeId'>) =>
        router.push({
          pathname: '/create/build/compare',
          params: { ...(jobId ? { jobId } : {}), ...(jdId ? { jdId } : {}) },
        }),
      /** No resume and no profile: ZERO 01, the role taken from the job. */
      openZeroResume: ({ jobId, role }: { jobId?: string; role?: string }) =>
        router.push({
          pathname: '/create/zero-resume',
          params: { ...(jobId ? { jobId } : {}), ...(role ? { role } : {}) },
        }),
      /** §13.5: a gated control names the limit it hit rather than opening a generic pitch. */
      openUpgrade,
      openUpload: () => router.push('/create/upload'),
      /** The parsed rows waiting to be accepted; the draft itself travels in `useImportStore`. */
      openUploadReview: () => router.replace('/create/upload-review'),
      /** TAILOR 02 swaps the compared resume in place, so back still leaves the flow in one step. */
      compareResume: (resumeId: string) => router.setParams({ resumeId }),
      openCoverLetter: () => router.push('/create/cover-letter'),
      openAtsCheck: () => router.push('/create/ats-check'),
      /** A finished run has its own screen; a started one replaces the intake behind it. */
      openGeneration: (generationId: string) =>
        router.replace({ pathname: '/generations/[id]', params: { id: generationId } }),
      openDocument: (resumeId: string) =>
        router.replace({ pathname: '/resumes/[id]', params: { id: resumeId } }),
      openResumes: () => router.navigate('/(tabs)/resumes'),
      /** Tailoring starts from a job, so a cover letter with nothing tailored sends you there. */
      openJobs: () => router.navigate('/(tabs)/jobs'),
      openProfileSkills: () => router.push('/profile/skills'),
    }),
    [openUpgrade, router],
  );
}
