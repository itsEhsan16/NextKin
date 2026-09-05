import {
  buildCoverLetterContent,
  buildResumeContent,
  newId,
  rescore,
  scoreFromKeywords,
} from '@/data/mock';
import type {
  ActivityEntry,
  ActivityKind,
  AtsScore,
  DocumentContent,
  Generation,
  GenerationKind,
  JdDraft,
  Resume,
} from '@/data/models';
import { ATS_BAND_LABEL, SCORE_LABEL } from '@/data/models';

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
 * The score a run with no JD lands on. Verbatim from the code this file replaces, down to the
 * two keyword misses: `__tests__/features/home/HomeScreen.test.tsx` drives the seeded
 * `gen_active` (which carries no `jdId`) to completion, and Home's progress card renders the
 * meter and the checks row derived from exactly these items. Anything else here changes that
 * artboard's state, so this path is preserved rather than generalised.
 */
const COMPLETED_SCORE = 83;

const legacyScore = (): AtsScore => ({
  total: COMPLETED_SCORE,
  band: 'good',
  summary: 'Solid foundation — a few fixes will push this into the green.',
  sections: [
    {
      key: 'content',
      label: 'Content',
      items: [
        { id: 'quantified', label: 'Quantified achievements in 3+ bullets', passed: true },
        { id: 'verbs', label: 'Action verbs open every bullet', passed: true },
        { id: 'summary', label: 'Summary under 60 words', passed: true },
      ],
    },
    {
      key: 'format',
      label: 'Format',
      items: [
        { id: 'column', label: 'Single column — parser safe', passed: true },
        { id: 'headings', label: 'Standard section headings', passed: true },
      ],
    },
    {
      key: 'keywords',
      label: 'Keywords',
      items: [
        { id: 'kw_1', label: '"creative tools" appears 3 times', passed: true },
        { id: 'kw_miss_0', label: 'Missing: "illustration"', passed: false, fixable: true },
        { id: 'kw_miss_1', label: 'Missing: "brand"', passed: false, fixable: true },
      ],
    },
  ],
});

/** Case-insensitive, so a profile's "Design systems" backs a JD's "design systems". */
const normalise = (value: string): string => value.trim().toLowerCase();

/**
 * V2 §7.8's three buckets, read off the confirmed JD (§7.5) against the profile:
 * `present` — required skills the profile backs, so the document may claim them;
 * `missing` — required skills it does not back yet, but which are plausible additions;
 * `unsupported` — preferred skills nothing in the profile supports. Those are shown as a gap and
 * never inserted: §7.8 forbids handing the user keywords to paste in.
 */
export function keywordSplit(
  draft: JdDraft,
  profileSkills: string[],
): { present: string[]; missing: string[]; unsupported: string[] } {
  const known = new Set(profileSkills.map(normalise));
  return {
    present: draft.requiredSkills.filter((skill) => known.has(normalise(skill))),
    missing: draft.requiredSkills.filter((skill) => !known.has(normalise(skill))),
    unsupported: draft.preferredSkills.filter((skill) => !known.has(normalise(skill))),
  };
}

/** The JD the run was tailored to, when it was tailored to one. */
export const jdDraftFor = (store: MockStore, generation: Generation): JdDraft | undefined =>
  generation.jdId ? store.state.jdDrafts.find((draft) => draft.id === generation.jdId) : undefined;

function scoreFor(
  store: MockStore,
  generation: Generation,
  resume: Resume,
  draft: JdDraft | undefined,
): AtsScore | undefined {
  // A letter is prose, not a parsed document — §7.8 scores resumes, so a letter gets no score.
  if (generation.kind === 'cover_letter') return undefined;

  if (draft) {
    const { present, missing, unsupported } = keywordSplit(draft, store.state.profile.skills);
    return scoreFromKeywords({
      present,
      missing,
      unsupported,
      // §7.9 drafts from assumptions: nothing is quantified and no portfolio is confirmed yet.
      ...(generation.kind === 'zero_resume'
        ? { contentMiss: 'Add numbers to the bullets you confirm', portfolioMiss: true }
        : {}),
    });
  }

  if (generation.kind === 'ats_check') {
    // No JD to score against, so the check re-reads the body it was run on and the score moves
    // only where the document itself changed (V2 §7.8).
    const previous: AtsScore | undefined = store.state.atsScores[resume.id];
    const content: DocumentContent | undefined = store.state.contents[resume.id];
    if (previous) return content ? rescore(previous, content) : clone(previous);
  }

  return legacyScore();
}

function contentFor(
  store: MockStore,
  generation: Generation,
  resume: Resume,
  draft: JdDraft | undefined,
): DocumentContent | undefined {
  // §7.8's standalone check reads a document that already exists; writing here would replace
  // the very body the user asked it to look at.
  if (generation.kind === 'ats_check') return undefined;

  const versionId = resume.currentVersionId;
  const role = draft?.title ?? resume.targetRole;
  const company = draft?.company ?? resume.targetCompany;

  if (generation.kind === 'cover_letter') {
    return buildCoverLetterContent({
      resumeId: resume.id,
      versionId,
      // Professional is §7.10's default when the setup screen did not pick a tone.
      tone: generation.tone ?? 'professional',
      company: company ?? 'the team',
      role: role ?? resume.title,
      skills: store.state.profile.skills,
    });
  }

  return buildResumeContent({
    resumeId: resume.id,
    versionId,
    targetRole: role,
    targetCompany: company,
    // §7.9: every role, project and education entry flagged and no employer named anywhere.
    needsReview: generation.kind === 'zero_resume',
  });
}

/**
 * A finished generation becomes the newest ready resume, so it is what Home's "Your Resume
 * Progress" card shows. It therefore has to arrive shaped like any other ready resume — with a
 * thumbnail, a completeness fraction and the three validation flags. Setting only the status and
 * the score left the card as an empty shell: blank thumbnail, unfilled meter, and no checks row
 * at all, none of which the artboard has a state for.
 *
 * The three values are derived from the score rather than invented, so they cannot drift from
 * the panel the user sees when they open it.
 */
function readyResume(resume: Resume, score: AtsScore | undefined, now: string): Resume {
  const base: Resume = {
    ...resume,
    status: 'ready',
    updatedAt: now,
    thumbnailUrl: resume.thumbnailUrl ?? 'asset:resume-thumb',
  };
  if (!score) return base;

  const items = score.sections.flatMap((section) => section.items);
  const allPassed = (key: string): boolean =>
    score.sections.find((section) => section.key === key)?.items.every((item) => item.passed) ??
    false;

  return {
    ...base,
    atsScore: score.total,
    completeness: items.length > 0 ? items.filter((item) => item.passed).length / items.length : 0,
    validation: {
      timelineValid: allPassed('content'),
      atsOptimized: allPassed('format'),
      jdMatched: allPassed('keywords'),
    },
  };
}

/** History has no 'interview' filter yet, so a question set files under the generic kind. */
export const GENERATION_ACTIVITY_KIND: Record<GenerationKind, ActivityKind> = {
  resume: 'generation',
  zero_resume: 'generation',
  cover_letter: 'cover_letter',
  ats_check: 'ats_check',
  interview: 'generation',
};

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
    ...(score ? { detail: `${SCORE_LABEL} ${score.total} · ${ATS_BAND_LABEL[score.band]}` } : {}),
    ...(generation.jobId ? { jobId: generation.jobId } : {}),
    deepLink: score ? `/resumes/${resume.id}/score` : '/placeholder/resume-detail',
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
  // §7.15 produces a question set, not a document; there is nothing here to leave finished.
  if (generation.kind === 'interview') return;
  const resumeId = generation.resumeId;
  if (!resumeId) return;
  const resume = store.state.resumes.find((item) => item.id === resumeId);
  if (!resume) return;

  const draft = jdDraftFor(store, generation);
  const content = contentFor(store, generation, resume, draft);
  const score = scoreFor(store, generation, resume, draft);
  const now = new Date().toISOString();

  if (content) store.state.contents[resumeId] = clone(content);
  if (score) store.state.atsScores[resumeId] = clone(score);

  const ready: Resume = {
    ...readyResume(resume, score, now),
    // §7.9's download gate: an assumed draft stays gated until the user confirms it.
    ...(generation.kind === 'zero_resume' ? { needsReview: true } : {}),
  };
  store.state.resumes = store.state.resumes.map((item) => (item.id === resumeId ? ready : item));

  appendReadyActivity(store, generation, ready, score, now);
}
