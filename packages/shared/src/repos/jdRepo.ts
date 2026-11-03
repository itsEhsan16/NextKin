import {
  withRequirements,
  compareResumeToJob,
  extractJdDraft,
  MockError,
  newId,
  simulate,
  SKILL_DICTIONARY,
} from '../mock';
import type { JdDraft } from '../models';
import { fallbackFigureDraft } from '../models/tailor';
import { estimatePages } from '../scoring/pages';
import { TAILOR_PATH } from '../scoring/fixPlan';
import { comparisonOf, improvementsFor } from '../scoring/tailorComparison';

import { jdFromDraft, scoreContent } from './scoring';
import { clone, findOrThrow, type MockStore } from './state';
import type { JdRepo } from './types';
import { placesOfContent } from '../scoring/documentFacts';
import { fitPlacesOfContent } from '../scoring/placeFit';

/**
 * NextKin V2 spec §7.5 — JD upload, extraction and the review screen.
 *
 * The extraction itself is pure and lives in `@/data/mock/jdExtractor`; this repo is only the
 * part a server would own — identity, the clock and the saved draft — so swapping it for
 * `POST /jd/extract` later changes nothing above it.
 */

/**
 * Extraction is the heaviest step in the intake flow and the only one whose progress copy has
 * something to say ("Reading the description…"), so it gets its own latency band instead of the
 * 300–900ms default: a result that lands before the sentence explaining it can be read is a
 * flicker, not a step.
 */
const EXTRACT_LATENCY = { minMs: 1200, maxMs: 2200 };

const hostOf = (url: string): string => {
  const match = /^(?:[a-z]+:\/\/)?([^/?#]+)/i.exec(url.trim());
  return match?.[1] ?? '';
};

export function createMockJdRepo(store: MockStore): JdRepo {
  const find = (id: string): JdDraft => findOrThrow(store.state.jdDrafts, id, 'JdDraft');

  /**
   * One extraction per job: a second comparison or a build reuses it, so the run that follows
   * reads the very JD the screen before it measured.
   */
  const draftForJob = (jobId: string): JdDraft => {
    findOrThrow(store.state.jobs, jobId, 'Job');
    const known = store.state.jdDrafts.find(
      (item) => item.source === 'job' && item.jobId === jobId,
    );
    if (known) return known;
    const draft = extractJdDraft(
      { source: 'job', jobId },
      {
        jobs: store.state.jobs,
        dictionary: SKILL_DICTIONARY,
        id: newId('jd'),
        now: new Date().toISOString(),
      },
    );
    store.state.jdDrafts = [clone(draft), ...store.state.jdDrafts];
    return draft;
  };

  return {
    extract: (input) =>
      simulate(() => {
        // Some sites block reading (BUILD 05b). The mock refuses any host with "blocked" in it,
        // so the paste-instead path can be demoed without breaking the real job boards the copy
        // promises work (LinkedIn, Naukri). A real fetch reports this itself.
        if (input.source === 'link' && /blocked/i.test(hostOf(input.url))) {
          throw new MockError('UNREADABLE_LINK', "We couldn't read that job page");
        }
        const draft = extractJdDraft(input, {
          jobs: store.state.jobs,
          dictionary: SKILL_DICTIONARY,
          // Ids and timestamps come from here so the extractor stays pure and testable.
          id: newId('jd'),
          now: new Date().toISOString(),
        });
        // Newest first: the JD history opens on the extraction the user just made.
        store.state.jdDrafts = [clone(draft), ...store.state.jdDrafts];
        return clone(draft);
      }, EXTRACT_LATENCY),

    get: (id) => simulate(() => clone(find(id))),

    update: (id, patch) =>
      simulate(() => {
        // What the review screen confirms is what generation, scoring and cover letters read,
        // so the patch is cloned in rather than held by reference (V2 §7.5).
        const updated: JdDraft = withRequirements({ ...find(id), ...clone(patch) });
        store.state.jdDrafts = store.state.jdDrafts.map((draft) =>
          draft.id === id ? updated : draft,
        );
        return clone(updated);
      }),

    forJob: (jobId) => simulate(() => clone(draftForJob(jobId)), EXTRACT_LATENCY),

    // The mock has no model: the plain draft, the line with its gap after "improving".
    draftFigure: (_resumeId, _roleId, _line, text) => simulate(() => fallbackFigureDraft(text)),

    compareToJd: (resumeId, jdId) =>
      simulate(() => {
        const resume = findOrThrow(store.state.resumes, resumeId, 'Resume');
        const draft = find(jdId);
        const content = store.state.contents[resumeId];
        const body = content?.kind === 'resume' ? content : undefined;
        // The server's measure: the resume's own text against the JD, the resume as yardstick.
        const result = body ? scoreContent(store.state, body, jdFromDraft(draft), { yardstick: 'document', path: TAILOR_PATH }) : undefined;
        const pages = body ? estimatePages(body) : undefined;
        return clone(
          comparisonOf({
            resumeId,
            jdId,
            rawText: draft.rawText,
            title: draft.title,
            ...(body ? { places: placesOfContent(body), fitPlaces: fitPlacesOfContent(body) } : {}),
            ...(draft.softSkills?.length ? { softSkills: draft.softSkills } : {}),
            ...(draft.jobId ? { jobId: draft.jobId } : {}),
            result,
            improvements: improvementsFor({
              headline: body?.headline ?? resume.targetRole ?? resume.title,
              summary: body?.summary ?? '',
              ...(resume.targetRole ? { writtenFor: resume.targetRole } : {}),
              ...(pages != null ? { pages, pagesEstimated: true } : {}),
              target: { title: draft.title, ...(draft.company ? { company: draft.company } : {}) },
            }),
            ...(pages != null ? { pageCount: pages, pagesEstimated: true } : {}),
          }),
        );
      }, EXTRACT_LATENCY),

    // The match engine is the server's (P11-03); the mock has no number to give a JD.
    match: (jdId) =>
      simulate(() => {
        find(jdId);
        return null;
      }),

    compare: (resumeId, jobId) =>
      simulate(() => {
        const resume = findOrThrow(store.state.resumes, resumeId, 'Resume');
        const job = findOrThrow(store.state.jobs, jobId, 'Job');
        const draft = draftForJob(jobId);
        const content = store.state.contents[resumeId];
        return clone(
          compareResumeToJob({
            resume,
            content,
            job,
            draft,
            result: content?.kind === 'resume' ? scoreContent(store.state, content, jdFromDraft(draft), { path: TAILOR_PATH }) : undefined,
          }),
        );
      }, EXTRACT_LATENCY),
  };
}
