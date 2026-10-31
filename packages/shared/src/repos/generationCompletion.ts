import { atsCheckFrom, newId } from '../mock';
import type { ActivityEntry, AtsScore, Generation, Resume } from '../models';
import type { DocumentScore } from '../scoring/report';
import { ATS_BAND_LABEL, GENERATION_ACTIVITY_KIND, SCORE_LABEL } from '../models';

import { contentFor, jdDraftFor, scoreFor } from './generationOutput';
import { jdForJob, jdFromDraft, withScoreFields } from './scoring';
import { completeInterviewSet } from './interviewCompletion';
import { clone, type MockStore } from './state';
/**
 * NextKin V2 spec §7.6 — what "ready" means.
 *
 * The last step of the pipeline, kept out of `generationsRepo` so the ticker stays a ticker. A
 * run that reaches 'ready' has to leave a document someone can actually open: a body in
 * `contents`, a score in `atsScores` where one applies, the Resume flipped with every field the
 * cards read, and a History entry. All five kinds land here; what differs is what they write —
 * a tailored resume (§7.6), a letter (§7.10), a Zero Resume draft (§7.9) and a standalone check
 * (§7.8), while an interview set (§7.15) produces no document at all.
 */

/**
 * A finished generation becomes the newest ready resume, so it is what Home's "Your Resume
 * Progress" card shows: a thumbnail, and — when it was scored — the completeness fraction and the
 * three validation flags, all read off the same engine run as the panel (C-10). A run with no JD
 * has no total (D-15), so the card shows its "not scored" state rather than a number.
 */
function readyResume(resume: Resume, result: DocumentScore | undefined, now: string): Resume {
  const base: Resume = {
    ...resume,
    status: 'ready',
    updatedAt: now,
    thumbnailUrl: resume.thumbnailUrl ?? 'asset:resume-thumb',
  };
  return result ? withScoreFields(base, result) : base;
}

function appendReadyActivity(
  store: MockStore,
  generation: Generation,
  resume: Resume,
  score: AtsScore | undefined,
  now: string,
): void {
  const entry: ActivityEntry = {
    id: newId('act'),
    kind: GENERATION_ACTIVITY_KIND[generation.kind],
    title: `**${resume.title}** is ready`,
    createdAt: now,
    resumeId: resume.id,
    // Spread rather than assign undefined: the store round-trips through JSON, which drops
    // undefined-valued keys, so an absent detail has to be an absent key here too.
    ...(score
      ? {
          detail: `${SCORE_LABEL} ${score.total} · ${ATS_BAND_LABEL[score.band]}`,
        }
      : {}),
    ...(generation.jobId ? { jobId: generation.jobId } : {}),
    deepLink: score ? `/resumes/${resume.id}/score` : `/resumes/${resume.id}`,
  };
  store.state.activity = [entry, ...store.state.activity];
  store.state.dashboardStats = {
    ...store.state.dashboardStats,
    activitiesCount: store.state.dashboardStats.activitiesCount + 1,
  };
}

/**
 * Finishes a run: body, score, the Resume's ready fields and the History entry, in that order.
 * Safe to call on a run with nothing to finish — an interview set, or one whose document has
 * since been deleted — so the ticker never has to ask.
 */
export function completeGeneration(store: MockStore, generation: Generation): void {
  // §7.15 produces a question set, not a document. It has its own completion, and it must NOT
  // fall through to `readyResume`: re-stamping the source resume for a run that changed nothing
  // about it would float it to the top of the library.
  if (generation.kind === 'interview') {
    completeInterviewSet(store, generation);
    return;
  }
  const resumeId = generation.resumeId;
  if (!resumeId) return;
  const resume = store.state.resumes.find((item) => item.id === resumeId);
  if (!resume) return;

  const draft = jdDraftFor(store, generation);
  const content = contentFor(store, generation, resume, draft);
  const result = scoreFor(store, generation, resume, draft, content);
  const score: AtsScore | undefined = result?.score;
  // §7.8's check against one job (toreview §73): its result lives on the run, read off the same
  // engine run as the document's panel.
  const atsCheck = generation.kind === 'ats_check' && draft && result ? atsCheckFrom({ result, resume, draft }) : undefined;
  const now = new Date().toISOString();
  if (atsCheck) {
    store.state.generations = store.state.generations.map((item) =>
      item.id === generation.id ? { ...item, atsCheck: clone(atsCheck) } : item,
    );
  }

  if (content) store.state.contents[resumeId] = clone(content);
  if (result) {
    const jobId = generation.jobId ?? resume.linkedJobId;
    const jd = draft ? jdFromDraft(draft) : (store.state.scoringJds[resumeId] ?? (jobId ? jdForJob(store.state, jobId) : undefined));
    if (jd) store.state.scoringJds[resumeId] = jd;
  }
  if (score) store.state.atsScores[resumeId] = clone(score);
  else if (result) delete store.state.atsScores[resumeId];

  const ready: Resume = {
    ...readyResume(resume, result, now),
    // §7.9's download gate: an assumed draft stays gated until the user confirms it.
    ...(generation.kind === 'zero_resume' ? { needsReview: true } : {}),
  };
  store.state.resumes = store.state.resumes.map((item) => (item.id === resumeId ? ready : item));

  appendReadyActivity(store, generation, ready, score, now);
}
