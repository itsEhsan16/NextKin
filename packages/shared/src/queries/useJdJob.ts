import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { jobFromJd, type JobFactsKnown } from '../jobs/fromJd';
import type { JdReading } from '../jobs/jdSections';
import type { JdDraft, Job } from '../models';
import { repos } from '../repos';
import { asOfDate, jdLists } from '../scoring/adapters';
import { jdPlausibility, type PlausibilityNote } from '../scoring/plausibility';

import { qk } from './keys';
import { useJdDraft } from './useJd';

/** How the profile matches a JD: its page's match card (the listing engine, on the server). */
export function useJdMatch(jdId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.jd.match(jdId),
    queryFn: () => repos.jd.match(jdId),
    enabled: jdId.length > 0 && options.enabled !== false,
  });
}

/**
 * A job description as its own page shows it (toreview §110): the draft, read as a `Job` for the
 * job page's sections, with the match on it once the server has one. The draft drives the page;
 * the match card appears when its number arrives.
 */
export function useJdJob(jdId: string): {
  draft: ReturnType<typeof useJdDraft>;
  view: { job: Job; known: JobFactsKnown; reading: JdReading; plausibility: PlausibilityNote[] } | undefined;
} {
  const draft = useJdDraft(jdId);
  const ready = draft.data?.status === undefined || draft.data.status === 'ready';
  const match = useJdMatch(jdId, { enabled: Boolean(draft.data) && ready });
  const data: JdDraft | undefined = draft.data;
  // What the JD asks that nobody could have, "20 years of React" (toreview §129).
  const view = useMemo(
    () => (data ? { ...jobFromJd(data, match.data), plausibility: data.status === 'extracting' ? [] : jdPlausibility(jdLists(data), asOfDate(new Date())) } : undefined),
    [data, match.data],
  );
  return { draft, view };
}

/**
 * A resume measured against a JD the user brought (W-TAILOR 01 on a JD's page, toreview §110).
 * Disabled until both ids are known, so the step can mount before the resume is picked.
 */
export function useJdComparison(resumeId: string, jdId: string) {
  return useQuery({
    queryKey: qk.jd.compareJd(resumeId, jdId),
    queryFn: () => repos.jd.compareToJd(resumeId, jdId),
    enabled: resumeId.length > 0 && jdId.length > 0,
  });
}

/**
 * "Did you use this here?" (toreview §206.3): asked once the comparison is on screen, and never
 * in its way. A failure shows no questions; the keyword table is unchanged either way.
 */
export function useKeywordQuestions(resumeId: string, jdId: string) {
  return useQuery({
    queryKey: qk.jd.questions(resumeId, jdId),
    queryFn: () => repos.jd.keywordQuestions(resumeId, jdId),
    enabled: resumeId.length > 0 && jdId.length > 0,
    staleTime: Infinity,
    retry: false,
  });
}

/** "Add the result", drafted (toreview §129): one bullet around a gap for its real figure. */
export function useDraftFigure() {
  return useMutation({
    mutationFn: (args: { resumeId: string; roleId: string; line: number; text: string }) =>
      repos.jd.draftFigure(args.resumeId, args.roleId, args.line, args.text),
  });
}

/** The JD id a failed reading kept, so the user can enter its fields by hand (V2 §7.5). */
export function unreadableJdId(error: unknown): string | undefined {
  const details = (error as { details?: { jdId?: unknown } } | null)?.details;
  return typeof details?.jdId === 'string' ? details.jdId : undefined;
}
