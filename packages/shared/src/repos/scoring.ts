import type { TargetPathOptions } from '@nextkin/engines/targetPlan';

import { extractJdDraft, SKILL_DICTIONARY } from '../mock';
import { nowIso } from '../mock/fixtures/time';
import type { AtsScore, JdDraft, Resume, ResumeContent } from '../models';
import { asOfDate, documentFromContent, documentFromProfile, PARSE_SAFE_TEMPLATE, profileContact } from '../scoring/adapters';
import { scoreDocument, type DocumentScore, type ScoringJd } from '../scoring/report';
import { scoringJdOf } from '../scoring/tailorComparison';
import type { MockState } from './state';

/**
 * The mock's scoring (C-10): every score both apps show comes from `packages/engines` through
 * `scoring/report.ts`. The fixed 83, the 96 ceiling, the +4 per fix and the seeded totals are gone;
 * a document scored against no JD has no total (D-15) and keeps the app's "not scored" state.
 */

/** A JD as the scorer reads it; shared with the server's comparison (toreview §110). */
export const jdFromDraft = (draft: JdDraft): ScoringJd => scoringJdOf(draft);

/** The JD a job listing reads as, through the same extractor `jd.forJob` uses. */
export function jdForJob(state: Pick<MockState, 'jobs'>, jobId: string): ScoringJd | undefined {
  if (!state.jobs.some((job) => job.id === jobId)) return undefined;
  const draft = extractJdDraft({ source: 'job', jobId }, { jobs: state.jobs, dictionary: SKILL_DICTIONARY, id: `jd_for_${jobId}`, now: nowIso() });
  return jdFromDraft(draft);
}

/**
 * Scores a resume body. A generated document is measured against the profile it came from (G16);
 * an upload checked on its own (`yardstick: 'document'`) against its own dated roles.
 */
export function scoreContent(
  state: Pick<MockState, 'profile'>,
  content: ResumeContent,
  jd: ScoringJd | undefined,
  options: { previous?: AtsScore; yardstick?: 'profile' | 'document'; path?: TargetPathOptions } = {},
): DocumentScore {
  return scoreDocument({
    document: documentFromContent(content, profileContact(state.profile)),
    format: PARSE_SAFE_TEMPLATE,
    asOf: asOfDate(new Date()),
    ...(jd ? { jd } : {}),
    ...(options.yardstick === 'document' ? {} : { profile: documentFromProfile(state.profile) }),
    ...(options.previous ? { previous: options.previous } : {}),
    ...(options.path ? { path: options.path } : {}),
  });
}

/** The resume's card fields from a score: the number only when one exists (D-15). */
export function withScoreFields(resume: Resume, result: DocumentScore): Resume {
  const { atsScore: _old, ...rest } = resume;
  return {
    ...rest,
    ...(result.score ? { atsScore: result.score.total } : {}),
    validation: result.validation,
    completeness: result.completeness,
  };
}

/** Commits a score: the panel (or its absence) and the resume's fields move together. */
export function commitScore(state: MockState, resumeId: string, result: DocumentScore): AtsScore | undefined {
  if (result.score) state.atsScores[resumeId] = result.score;
  else delete state.atsScores[resumeId];
  state.resumes = state.resumes.map((r) => (r.id === resumeId ? withScoreFields(r, result) : r));
  return result.score;
}

/** Re-scores a stored resume after an edit, against the JD it was scored for. */
export function rescoreStored(state: MockState, resumeId: string, content: ResumeContent): AtsScore | undefined {
  const result = scoreContent(state, content, state.scoringJds[resumeId], { previous: state.atsScores[resumeId] });
  return commitScore(state, resumeId, result);
}

/**
 * Seeds every fixture resume's score from its body and its linked job, so a seeded number is as
 * computed as a generated one. The profile's average follows from them (C-11).
 */
export function seedScores(state: MockState): void {
  for (const resume of state.resumes) {
    const content = state.contents[resume.id];
    if (resume.docType !== 'resume' || !content || content.kind !== 'resume') continue;
    const jd = resume.linkedJobId ? jdForJob(state, resume.linkedJobId) : undefined;
    if (jd) state.scoringJds[resume.id] = jd;
    commitScore(state, resume.id, scoreContent(state, content, jd));
  }
  const totals = Object.values(state.atsScores).map((s) => s.total);
  const { avgAtsScore: _seeded, ...stats } = state.profile.stats;
  state.profile = {
    ...state.profile,
    stats: totals.length ? { ...stats, avgAtsScore: Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) } : stats,
  };
}
