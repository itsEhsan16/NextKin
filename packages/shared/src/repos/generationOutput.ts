import { buildCoverLetterContent, buildResumeContent, buildZeroDraft } from '../mock';
import type { DocumentContent, Generation, JdDraft, Resume } from '../models';
import type { DocumentScore } from '../scoring/report';

import { jdForJob, jdFromDraft, scoreContent } from './scoring';
import type { MockStore } from './state';

/**
 * NextKin V2 spec §7.6 and §7.8 — what a finished generation produces.
 *
 * Split out of `generationCompletion` so this file derives the document and its score, and that
 * one commits them to the store. Nothing here writes: every function takes what it needs and
 * returns a value, which is what makes the scoring rules readable on their own.
 */

/** Case-insensitive, for ordering the profile's skills by what the job asks (BUILD 06). */
const normalise = (value: string): string => value.trim().toLowerCase();

/** The JD the run was tailored to, when it was tailored to one. */
export const jdDraftFor = (store: MockStore, generation: Generation): JdDraft | undefined =>
  generation.jdId ? store.state.jdDrafts.find((draft) => draft.id === generation.jdId) : undefined;

/**
 * The run's score, from the engines (V2 §7.8, C-10). A letter is prose and a Zero Resume draft is
 * written for no job, so neither gets one. Everything else is scored as the document the run left:
 * against the run's JD; failing that, the JD it was last scored against, or the listing of the job
 * it was made for. With no JD at all there is no total (D-15), and the document keeps the "not
 * scored" state.
 */
export function scoreFor(
  store: MockStore,
  generation: Generation,
  resume: Resume,
  draft: JdDraft | undefined,
  content: DocumentContent | undefined,
): DocumentScore | undefined {
  if (generation.kind === 'cover_letter' || generation.kind === 'zero_resume') return undefined;
  const body = content ?? store.state.contents[resume.id];
  if (!body || body.kind !== 'resume') return undefined;
  const jobId = generation.jobId ?? resume.linkedJobId;
  const jd = draft
    ? jdFromDraft(draft)
    : (store.state.scoringJds[resume.id] ?? (jobId ? jdForJob(store.state, jobId) : undefined));
  return scoreContent(store.state, body, jd, {
    previous: store.state.atsScores[resume.id],
    // A check reads the document on its own terms; a generated one answers to the profile (G16).
    yardstick: generation.kind === 'ats_check' ? 'document' : 'profile',
  });
}

/** The profile's skills with the ones the job asks for first, in the job's order (BUILD 06). */
function jobFirst(skills: readonly string[], draft: JdDraft | undefined): string[] {
  if (!draft) return [...skills];
  const asks = [...draft.requiredSkills, ...draft.preferredSkills].map(normalise);
  const rank = (skill: string) => {
    const at = asks.indexOf(normalise(skill));
    return at < 0 ? asks.length : at;
  };
  return [...skills].sort((a, b) => rank(a) - rank(b));
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

  // §7.9: drafted from the seed alone, every guess flagged and every unknown left a blank.
  if (generation.kind === 'zero_resume') {
    return buildZeroDraft({
      resumeId: resume.id,
      versionId,
      seed: generation.zero ?? { fullName: '', yearsExperience: 0 },
      year: new Date().getFullYear(),
    });
  }

  // A tailoring run starts from the resume the user picked, plus the keywords they said yes to.
  const source = generation.tailor
    ? store.state.contents[generation.tailor.sourceResumeId]
    : undefined;
  // A source that lists no skills of its own (the web library's bodies carry none) starts from
  // the profile's, so the tailored copy is never left with only the keywords just added.
  const start =
    source?.kind === 'resume'
      ? source.skills.length
        ? source.skills
        : store.state.profile.skills
      : undefined;
  const skills =
    start && generation.tailor
      ? [...start, ...generation.tailor.added.filter((k) => !start.includes(k))]
      : undefined;

  // A build writes from the profile (toreview §67): its skills, with what the job asks first.
  const built =
    generation.origin === 'build' ? jobFirst(store.state.profile.skills, draft) : undefined;

  const content = buildResumeContent({
    resumeId: resume.id,
    versionId,
    ...(skills ? { skills } : built ? { skills: built } : {}),
    targetRole: role,
    targetCompany: company,
  });
  // "Headline aimed at Lead UX Designer": a tailoring run that aims the headline writes it, unless
  // the web flow was told to leave it (`toreview.md` §103).
  const aimHeadline =
    generation.tailor && role && (generation.tailor.fixes?.includes('headline') ?? true);
  return aimHeadline && content.kind === 'resume' ? { ...content, headline: role } : content;
}
