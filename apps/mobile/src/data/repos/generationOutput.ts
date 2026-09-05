import {
  buildCoverLetterContent,
  buildResumeContent,
  rescore,
  scoreFromKeywords,
} from '@/data/mock';
import type { AtsScore, DocumentContent, Generation, JdDraft, Resume } from '@/data/models';

import { clone, type MockStore } from './state';

/**
 * NextKin V2 spec §7.6 and §7.8 — what a finished generation produces.
 *
 * Split out of `generationCompletion` so this file derives the document and its score, and that
 * one commits them to the store. Nothing here writes: every function takes what it needs and
 * returns a value, which is what makes the scoring rules readable on their own.
 */

const COMPLETED_SCORE = 83;

export const legacyScore = (): AtsScore => ({
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

export function scoreFor(
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

export function contentFor(
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
