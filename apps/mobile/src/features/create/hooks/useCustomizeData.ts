import { useMemo } from 'react';

import { defaultTailorPick, tailorableResumes } from '@/data/models';
import {
  useJdComparison,
  useJdDraft,
  useJob,
  useProfile,
  useResume,
  useResumes,
  useSubscription,
  useTailorComparison,
} from '@/data/queries';

import { draftMetaLine } from '../components/BuildReviewCard';
import { jobMetaLine, type VsTarget } from '../components/TailorVsCard';
import type { CustomizeTarget } from './useCreateActions';

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'NOT_FOUND';

/**
 * Everything the Customize screen reads (toreview §114), for a listing (`jobId`) or a JD the user
 * brought (`jdId`): the job as the card shows it, the resume — the one asked for, else the base
 * (`defaultTailorPick`) — the comparison of the two, the plan and the profile (for "Build from my
 * profile" when there is no resume). Every query runs unconditionally; the unused ones stay off.
 */
export function useCustomizeData({ jobId, jdId, resumeId }: CustomizeTarget) {
  const job = useJob(jobId ?? '');
  const draft = useJdDraft(jobId ? '' : (jdId ?? ''));
  const resumes = useResumes();
  const subscription = useSubscription();
  const profile = useProfile();

  const offered = useMemo(
    () => (resumes.data ? tailorableResumes(resumes.data) : undefined),
    [resumes.data],
  );
  // The resume asked for wins even when the sheet would not offer it (ATS 03's checked copy).
  const pickedId = resumeId ?? (offered ? defaultTailorPick(offered) : undefined) ?? '';
  const resume = useResume(pickedId);
  const byJob = useTailorComparison(jobId ? pickedId : '', jobId ?? '');
  const byJd = useJdComparison(jobId ? '' : pickedId, jobId ? '' : (jdId ?? ''));
  const comparison = jobId ? byJob : byJd;

  const source = jobId ? job : draft;
  const company = jobId ? job.data?.company : draft.data?.company;
  const target: VsTarget | undefined = job.data
    ? { title: job.data.title, company: job.data.company, meta: jobMetaLine(job.data) }
    : draft.data
      ? {
          title: draft.data.title,
          ...(draft.data.company ? { company: draft.data.company } : {}),
          meta: draftMetaLine(draft.data) || 'Job description you added',
        }
      : undefined;

  return {
    target,
    /** "what {company} asks for": a pasted JD may name no company. */
    company: company ?? 'this job',
    /** The JD the run and "Details" read: the listing's comes with its comparison. */
    jdId: jobId ? comparison.data?.jdId : jdId,
    targetQuery: source,
    targetMissing: source.isError && isNotFound(source.error),
    resumes,
    noResume: offered != null && offered.length === 0 && resumeId == null,
    resumeId: pickedId,
    resume,
    comparison,
    subscription,
    profile,
  };
}
