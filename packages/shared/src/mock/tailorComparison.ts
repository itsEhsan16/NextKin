import type { DocumentContent, Job, Resume, TailorComparison } from '../models';
import type { JdDraft } from '../models/jd';
import type { DocumentScore } from '../scoring/report';
import { comparisonOf, improvementsFor, keywordsFrom } from '../scoring/tailorComparison';
import { placesOfContent } from '../scoring/documentFacts';
import { fitPlacesOfContent } from '../scoring/placeFit';

/**
 * "Your resume vs this job" (TAILOR 02, toreview §56), on the mock. The comparison's pure parts
 * are shared with the server (`scoring/tailorComparison.ts`, toreview §110). The seeded boards
 * keep only their row copy and page count; their numbers and keyword lists are the engine's.
 */

export { keywordsFrom };

export function compareResumeToJob(args: {
  resume: Resume;
  content: DocumentContent | undefined;
  job: Job;
  draft: JdDraft;
  /** The engine run of this resume against this job's JD. */
  result: DocumentScore | undefined;
}): TailorComparison {
  const { resume, content, job, draft, result } = args;
  const seeded = TAILOR_COMPARISON_SEEDS[`${resume.id}:${job.id}`];
  const body = content?.kind === 'resume' ? content : undefined;
  const pageCount = seeded?.pageCount ?? resume.pageCount;
  return comparisonOf({
    resumeId: resume.id,
    jobId: job.id,
    jdId: draft.id,
    // A JD with no skill the engines can read has no total (D-15); the comparison then says 0.
    result,
    // The JD's own lines, for each keyword's quote and the fix plan (toreview §112, §115).
    rawText: draft.rawText,
    title: draft.title,
    improvements:
      seeded?.improvements ??
      improvementsFor({
        headline: body?.headline ?? resume.targetRole ?? resume.title,
        summary: body?.summary ?? '',
        ...(resume.targetRole ? { writtenFor: resume.targetRole } : {}),
        ...(resume.pageCount != null ? { pages: resume.pageCount } : {}),
        target: { title: job.title, company: job.company },
      }),
    ...(pageCount != null ? { pageCount } : {}),
    // Where a tapped keyword may be said to be used (toreview §114), so the mock offers it too.
    ...(body ? { places: placesOfContent(body), fitPlaces: fitPlacesOfContent(body) } : {}),
  });
}

/**
 * The rows two boards draw verbatim, kept as copy: TAILOR 02 (607:2, the base "Product Designer"
 * against Stripe) and W-TAILOR 01 (734:2). Their totals and keyword lists are the engine's now
 * (C-10, toreview §105.15).
 */
const TAILOR_COMPARISON_SEEDS: Record<
  string,
  Pick<TailorComparison, 'improvements'> & Partial<Pick<TailorComparison, 'pageCount'>>
> = {
  /**
   * W-TAILOR 01's rows verbatim (734:2): the web library's base Product Designer resume against
   * Google's Lead UX Designer, a three-page resume (`toreview.md` §103). Its 72 and keyword list
   * are now the engine's (C-10, toreview §105.15).
   */
  'res_pd:job_google': {
    pageCount: 3,
    improvements: [
      {
        key: 'headline',
        label: 'Job title',
        detail: 'Different from the job’s title — we’ll aim your headline at it',
        ok: false,
      },
      {
        key: 'summary',
        label: 'Summary',
        detail:
          'Your summary is written for UX roles. It doesn’t mention leading design work or design systems, which this job asks for.',
        ok: false,
      },
      {
        key: 'length',
        label: 'Length',
        detail: '3 pages. Recruiters skim one or two, so we’ll bring it to two.',
        ok: false,
      },
      {
        key: 'layout',
        label: 'Layout',
        detail: 'One column with standard headings — easy for an ATS to read.',
        ok: true,
      },
    ],
  },
  'res_base:job_stripe': {
    improvements: [
      {
        key: 'headline',
        label: 'Headline',
        detail: 'Says Senior UX Designer. This job is Senior Product Designer.',
        ok: false,
      },
      {
        key: 'summary',
        label: 'Summary',
        detail: 'Written for UX roles, not for this one.',
        ok: false,
      },
      {
        key: 'length',
        label: 'Length',
        detail: '3 pages. Recruiters skim one or two.',
        ok: false,
      },
      {
        key: 'layout',
        label: 'Layout',
        detail: 'Easy for an ATS to read.',
        ok: true,
      },
    ],
  },
};
