import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { TailorChoices } from '@/data/models';
import { useExtractJd, useStartGeneration, useSubscription } from '@/data/queries';

import { buildCostNote, spentNote } from '../generationQuota';
import { useCreateActions } from './useCreateActions';

/** Where a build starts from: a NextKin job (read first) or a JD that was already read. */
export type StartBuildInput = {
  jobId?: string;
  jdId?: string;
  /** BUILD 04c's answers: the missing keywords the user has, and the ones left out. */
  build?: TailorChoices;
};

/** Where BUILD 04b reads the job from: a saved job, or a JD read on BUILD 03/04. */
export type BuildCompareTarget = { jobId?: string; jdId?: string };

export type StartBuild = {
  /** One tap: reads the job's JD when needed, starts the run, then replaces with its screen. */
  start: (input: StartBuildInput) => void;
  pending: boolean;
  /** V2 §7.6: a failed start is never silent; the caller shows this beside its retry. */
  error?: string;
  /** V2 §13.5: with the allowance gone, `start` opens the upgrade screen instead. */
  quotaSpent: boolean;
  /** What pressing costs ("Uses 1 of your 3 resume builds this month"), or the spent line. */
  quotaNote: string;
  /** Runs the last start again, after `error`. */
  retry: () => void;
};

export const BUILD_START_FAILED =
  "We couldn't start your resume. Check your connection and try again.";

export type BuildQuota = {
  /** V2 §13.5: with the allowance gone, the build's button opens the upgrade screen instead. */
  quotaSpent: boolean;
  /** What a build costs ("Uses 1 of your 3 resume builds this month"), or the spent line. */
  quotaNote: string;
};

/** The resume-build allowance as BUILD 02 and 04c say it; empty until the plan is read. */
export function useBuildQuota(): BuildQuota {
  const subscription = useSubscription();
  const usage = subscription.data?.usage;
  const limit = usage?.generationsLimit ?? 0;
  const quotaSpent = usage != null && usage.generationsUsed >= limit;
  const quotaNote = usage == null ? '' : quotaSpent ? spentNote(limit) : buildCostNote(limit);
  return { quotaSpent, quotaNote };
}

/**
 * Starts a Build Resume run (BUILD 04b/04c, toreview §74): a resume built from the profile for one
 * job, tagged `origin: 'build'` so the run screens know which flow they belong to, carrying what
 * the user answered about the missing keywords.
 */
export function useStartBuild(): StartBuild {
  const actions = useCreateActions();
  const { quotaSpent, quotaNote } = useBuildQuota();
  const extract = useExtractJd();
  const generate = useStartGeneration();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  // A second tap while a start is in flight must not spend a second build.
  const busy = useRef(false);
  const last = useRef<StartBuildInput | undefined>(undefined);

  const { mutateAsync: extractJd } = extract;
  const { mutateAsync: startGeneration } = generate;
  const { openGeneration, openUpgrade } = actions;

  const start = useCallback(
    ({ jobId, jdId, build }: StartBuildInput) => {
      if (busy.current) return;
      if (quotaSpent) {
        openUpgrade('generations');
        return;
      }
      if (jobId == null && jdId == null) return;
      last.current = { jobId, jdId, build };
      busy.current = true;
      setPending(true);
      setError(undefined);
      void (async () => {
        try {
          const id = jdId ?? (await extractJd({ source: 'job', jobId: jobId ?? '' })).id;
          const generation = await startGeneration({
            kind: 'resume',
            jdId: id,
            ...(jobId != null ? { jobId } : {}),
            ...(build ? { build } : {}),
            origin: 'build',
          });
          openGeneration(generation.id);
        } catch {
          setError(BUILD_START_FAILED);
        } finally {
          busy.current = false;
          setPending(false);
        }
      })();
    },
    [extractJd, openGeneration, openUpgrade, quotaSpent, startGeneration],
  );

  const retry = useCallback(() => {
    if (last.current) start(last.current);
  }, [start]);

  return { start, pending, error, quotaSpent, quotaNote, retry };
}

/** Where the BUILD screens go besides the run (the run itself is `useStartBuild`'s). */
export function useBuildActions() {
  const router = useRouter();
  const { goBack, openUpgrade } = useCreateActions();
  return useMemo(
    () => ({
      goBack,
      openUpgrade,
      openChooseJob: () => router.push('/create/build/jobs'),
      openAddJob: () => router.push('/create/build/add'),
      openCompare: ({ jobId, jdId }: BuildCompareTarget) =>
        router.push({
          pathname: '/create/build/compare',
          params: { ...(jobId ? { jobId } : {}), ...(jdId ? { jdId } : {}) },
        }),
      openProfileEditor: () => router.push('/profile/edit'),
      browseJobs: () => router.navigate('/(tabs)/jobs'),
    }),
    [goBack, openUpgrade, router],
  );
}
