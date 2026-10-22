import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { UpgradeReason } from '@/features/billing';
import { customizeParams } from '@/features/create/hooks/useCreateActions';

/** Every tap target on the generation progress screen resolves here (V2 §7.6). */
export function useGenerationsActions() {
  const router = useRouter();

  return useMemo(
    () => ({
      goBack: () => router.back(),
      /**
       * ✕ on a job-first tailoring run (TAILOR 04–06): back to the Job Detail the flow started
       * from, past the compare and add-or-skip steps. When that screen is not in the stack (the
       * run was reopened from Home's card) `dismissTo` replaces this screen with it instead.
       */
      closeFlow: (jobId?: string) =>
        jobId ? router.dismissTo({ pathname: '/jobs/[id]', params: { id: jobId } }) : router.back(),
      /**
       * ✕ on a Build Resume run (BUILD 05/06): back to the job when the build was for a NextKin
       * one; a job pasted or uploaded from Home has no page to return to, so Home it is.
       */
      closeBuild: (jobId?: string) =>
        jobId
          ? router.dismissTo({ pathname: '/jobs/[id]', params: { id: jobId } })
          : router.dismissTo('/(tabs)'),
      /** BUILD 06's "Cover letter for this job": COVER 01 set up with the resume just built. */
      openCoverLetterSetup: (resumeId: string) =>
        router.push({ pathname: '/create/cover-letter', params: { resumeId } }),
      /** BUILD 06's "Practice the interview": the question-set setup, about the new resume. */
      openInterviewSetup: (resumeId: string) =>
        router.push({ pathname: '/interview/new', params: { resumeId } }),
      /**
       * A new run in place of this one — COVER 03's "Try another tone". Replace, not push: the
       * earlier letter is kept in Resumes, and Back should not walk through every draft.
       */
      openRun: (id: string) => router.replace({ pathname: '/generations/[id]', params: { id } }),
      /** §13.5: a spent allowance routes to the plans instead of starting the work. */
      openUpgrade: (reason: UpgradeReason) =>
        router.push({ pathname: '/upgrade', params: { reason } }),
      /** The finished run's score panel — the designed per-document screen (RESUMES 04). */
      openScore: (resumeId: string) =>
        router.push({ pathname: '/resumes/[id]/score', params: { id: resumeId } }),
      /** The document itself (V2 §7.11) — the editor, whether or not the run produced a score. */
      openDocument: (resumeId: string) =>
        router.push({ pathname: '/resumes/[id]', params: { id: resumeId } }),
      /** An interview run's output is a practice set, not a document (V2 §7.15). */
      openInterviewSet: (setId: string) =>
        router.replace({ pathname: '/interview/[id]', params: { id: setId } }),
      openInterviewLibrary: () => router.replace('/interview'),
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
      /** §7.8: the rubric behind a score, from the score itself (ATS 03's pill). */
      openRubric: (resumeId: string) =>
        router.push({ pathname: '/resumes/[id]/rubric', params: { id: resumeId } }),
      /**
       * ATS 03's "Fix it for this job": Customize (toreview §114) for the saved job or the pasted
       * description, with the checked file.
       */
      openCustomize: (target: { jobId?: string; jdId?: string; resumeId: string }) =>
        router.push({ pathname: '/create/tailor', params: customizeParams(target) }),
      /**
       * A failed tailoring run's "Change my choices": Customize again for the same job and
       * resume, in place of the failure. The choices are still there (`customizeStore`).
       */
      backToCustomize: (target: { jobId?: string; jdId?: string; resumeId?: string }) =>
        router.replace({ pathname: '/create/tailor', params: customizeParams(target) }),
    }),
    [router],
  );
}
