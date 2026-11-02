import type { Job, TailorComparison } from '@nextkin/shared/models';
import { useJdComparison, useJdJob, useJob, useTailorComparison } from '@nextkin/shared/queries';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Route } from 'next';

import { jdHref } from '../jd/jdHref';
import { jobPageHref } from '../jobs/jobPageLibrary';
import { listingLines } from './tailorLibrary';

/**
 * What a tailor run aims at (toreview §110): a job listing on NextKin (`/jobs/<id>/tailor`), or a
 * job description the user brought (`/jd/<id>/tailor`). The steps read it as a `Job` either way:
 * a JD is the job its reading describes (`jobFromJd`).
 */
export type TailorTargetRef = { kind: 'job' | 'jd'; id: string };

/**
 * The W-FLOW steps after the job (toreview §126): how to make the resume — which includes which
 * resume to tailor (toreview §151–§152) — then what to add. The comparison folded into Enhance
 * (owner, 2026-11-02, toreview §149).
 */
export type TailorStep = 'resume' | 'enhance';

/**
 * `?step=` as a step. An old `compare` link opens Enhance, where the comparison now lives; an old
 * `method` link opens the resume step, which it became (toreview §152).
 */
export function parseTailorStep(value: string | null): TailorStep | undefined {
  if (value === 'resume' || value === 'enhance') return value;
  if (value === 'method') return 'resume';
  return value === 'compare' ? 'enhance' : undefined;
}

export type TailorQuery = { resumeId?: string; step?: TailorStep; run?: string; mode?: 'build' };

/** The tailor flow's address, with what it should open on. */
export function tailorPath(ref: TailorTargetRef, query: TailorQuery = {}): Route {
  const base =
    ref.kind === 'jd'
      ? `/jd/${encodeURIComponent(ref.id)}/tailor`
      : `/jobs/${encodeURIComponent(ref.id)}/tailor`;
  const params = new URLSearchParams();
  if (query.run) params.set('run', query.run);
  if (query.resumeId) params.set('resumeId', query.resumeId);
  if (query.step) params.set('step', query.step);
  if (query.mode) params.set('mode', query.mode);
  const search = params.toString();
  return (search ? `${base}?${search}` : base) as Route;
}

/** The page the flow came from: the job's own page, or the JD's. */
export const targetPageHref = (ref: TailorTargetRef): Route =>
  ref.kind === 'jd' ? jdHref(ref.id) : jobPageHref(ref.id);

/** "Back to job" or "Back to the job description", as the flow's buttons say it. */
export const backLabel = (ref: TailorTargetRef) =>
  ref.kind === 'jd' ? 'Back to the job description' : 'Back to job';

/**
 * The target as a `Job`, and the comparison of one resume with it. Every hook runs on every render
 * (React's rule); the one for the other kind gets an empty id, which keeps it idle.
 */
export function useTailorTarget(
  ref: TailorTargetRef,
  resumeId: string,
): {
  job: Job | undefined;
  /** The job's own lines, for step 2's "In …": a JD's whole text, a listing's requirements. */
  lines: readonly string[];
  jobError: boolean;
  comparison: UseQueryResult<TailorComparison>;
  refetch: () => void;
} {
  const listing = useJob(ref.kind === 'job' ? ref.id : '', { seedFromLists: true });
  const jd = useJdJob(ref.kind === 'jd' ? ref.id : '');
  const forJob = useTailorComparison(
    ref.kind === 'job' ? resumeId : '',
    ref.kind === 'job' ? ref.id : '',
  );
  const forJd = useJdComparison(ref.kind === 'jd' ? resumeId : '', ref.kind === 'jd' ? ref.id : '');
  const job = ref.kind === 'jd' ? jd.view?.job : listing.data;
  const jobError = ref.kind === 'jd' ? jd.draft.isError : listing.isError;
  const comparison = ref.kind === 'jd' ? forJd : forJob;
  const lines =
    ref.kind === 'jd'
      ? (jd.draft.data?.rawText.split(/\r?\n/) ?? [])
      : listing.data
        ? listingLines(listing.data)
        : [];
  return {
    job,
    lines,
    jobError,
    comparison,
    refetch: () => {
      void (ref.kind === 'jd' ? jd.draft.refetch() : listing.refetch());
      void comparison.refetch();
    },
  };
}
