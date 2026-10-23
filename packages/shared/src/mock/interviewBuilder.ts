import type { InterviewQuestion, InterviewSet, JdDraft, Resume, ResumeContent } from '../models';
import { fromBank, INTERVIEW_SET_MAX, INTERVIEW_SET_MIN } from '../interview/bank';

export { INTERVIEW_SET_MAX, INTERVIEW_SET_MIN };

/**
 * NextKin V2 spec §7.15 — how a practice set is written.
 *
 * The rules it encodes are the spec's acceptance criteria, and each is checkable without a mount:
 *   1. Technical questions come ONLY from skills the resume actually claims that the job also
 *      asks for — the intersection, minus anything the score flagged as unsupported. "Every
 *      technical question maps to a skill present on that resume."
 *   2. Behavioural questions come from the job's responsibilities, then the resume's own roles.
 *   3. A short set is padded toward §7.15's 10–20 from the behavioural bank ONLY. A generic
 *      behavioural question is honest; a generic technical one claims a skill the resume lacks.
 *   4. A standalone set (no resume) is written from the role title alone, carries no `skill`
 *      links, and is flagged `source: 'standalone'` so the screens can label it generic.
 *   5. Deterministic and index-driven — no randomness — so tests pin exact output.
 *
 * A real generator runs a model over the document; this is the mock's stand-in, and it stays
 * honest about being one.
 */

const lower = (value: string): string => value.trim().toLowerCase();

/** Case-insensitive set membership, so "figma" and "Figma" are one skill. */
const includes = (list: readonly string[], skill: string): boolean =>
  list.some((entry) => lower(entry) === lower(skill));

/** The technical questions, one template per skill; the answer names the reader's own claim. */
const technical = (skill: string, roleTitle: string, index: number): InterviewQuestion => ({
  id: `q_tech_${index}`,
  kind: 'technical',
  skill,
  prompt: `Walk me through a piece of work where ${skill} made the difference. What did you do, and how did you know it worked?`,
  answer:
    `Pick one project, and lead with the outcome. Say what the problem was, what you did with ${skill} specifically — not what the team did — and what changed afterwards, with a number if you have one. ` +
    `Then say what you would do differently. A ${roleTitle} is expected to have opinions about the tool, not only fluency in it.`,
  talkingPoints: [
    `Your resume claims ${skill}, so pick the example that backs that claim best.`,
    'One project, told in the order it happened: problem, what you did, result.',
    'A measured outcome beats an adjective — "cut onboarding from five days to two".',
    'End with what you learned; it turns a war story into evidence of judgement.',
  ],
  mark: 'unmarked',
});

/** Behavioural questions written from a responsibility line the job itself listed. */
const fromResponsibility = (line: string, index: number): InterviewQuestion => ({
  id: `q_resp_${index}`,
  kind: 'behavioural',
  prompt: `The role involves "${line.replace(/\.$/, '').toLowerCase()}". Tell me about a time you did something like that.`,
  answer:
    'Use the shape they are listening for: the situation in one sentence, the task you owned, the action you took, and the result. Spend most of the answer on the action — that is the part that is yours. ' +
    'If the honest answer is "not at this scale", say so and describe the nearest thing you have done; a candid near-miss lands better than a stretched match.',
  talkingPoints: [
    'Situation → task → action → result, and most of the time on the action.',
    'Name the constraint you were working under; it makes the result mean something.',
    'If you have not done exactly this, say what you have done that is closest.',
  ],
  mark: 'unmarked',
});

export type BuildInterviewSetInput = {
  setId: string;
  now: string;
  generationId?: string;
  resume?: Pick<Resume, 'id' | 'title' | 'targetRole' | 'targetCompany'>;
  content?: Pick<ResumeContent, 'skills' | 'experience'>;
  draft?: Pick<
    JdDraft,
    | 'id'
    | 'jobId'
    | 'title'
    | 'company'
    | 'requiredSkills'
    | 'preferredSkills'
    | 'tools'
    | 'responsibilities'
  >;
  /** Skills the score flagged as unsupported — §7.15 will not rehearse a claim the document lost. */
  excludedSkills?: readonly string[];
  /** Standalone mode: the role title the set is written for. */
  roleTitle?: string;
  regeneratedFromId?: string;
};

export function buildInterviewSet(input: BuildInterviewSetInput): InterviewSet {
  const {
    setId,
    now,
    resume,
    content,
    draft,
    excludedSkills = [],
    roleTitle,
    generationId,
  } = input;

  // Standalone: role title alone, from the bank, labelled generic by `source`.
  if (!resume) {
    const title = (roleTitle ?? draft?.title ?? 'Interview practice').trim();
    const questions = Array.from({ length: INTERVIEW_SET_MIN }, (_, index) =>
      fromBank(index, `q_bank_${index}`),
    );
    return {
      id: setId,
      title,
      source: 'standalone',
      roleTitle: title,
      questions,
      createdAt: now,
      ...(generationId ? { generationId } : {}),
      ...(input.regeneratedFromId ? { regeneratedFromId: input.regeneratedFromId } : {}),
    };
  }

  const role = resume.targetRole ?? draft?.title ?? 'this role';
  const claimed = content?.skills ?? [];
  const asked = draft
    ? [...draft.requiredSkills, ...draft.preferredSkills, ...draft.tools]
    : // No JD to intersect with: every claimed skill is fair game, the resume is the only source.
      claimed;
  // Rule 1: claimed ∩ asked, minus what the score could not back. Required skills first, in the
  // draft's own order, so the questions the reader is likeliest to face come first.
  const technicalSkills = asked.filter(
    (skill, index) =>
      includes(claimed, skill) &&
      !includes(excludedSkills, skill) &&
      asked.findIndex((other) => lower(other) === lower(skill)) === index,
  );

  const technicalQuestions = technicalSkills
    .slice(0, INTERVIEW_SET_MAX / 2)
    .map((skill, index) => technical(skill, role, index));

  // Rule 2: the job's responsibilities, then the resume's own roles as behavioural prompts.
  const responsibilities = (draft?.responsibilities ?? []).slice(0, 6);
  const behavioural: InterviewQuestion[] = responsibilities.map(fromResponsibility);
  (content?.experience ?? []).slice(0, 2).forEach((entry, index) => {
    behavioural.push({
      id: `q_role_${index}`,
      kind: 'behavioural',
      prompt: `Your resume lists ${entry.title} at ${entry.company}. What are you proudest of from that time, and what would you change?`,
      answer:
        'One thing you are proud of, told with its outcome, and one thing you would now do differently — a candidate who can name both is showing judgement, which is what the question is for.',
      talkingPoints: [
        `This is from your ${entry.company} role — pick something that role's bullets already claim.`,
        'One pride, one regret, both with outcomes.',
      ],
      mark: 'unmarked',
    });
  });

  // Rule 3: pad from the behavioural bank only, toward the floor.
  let questions = [...technicalQuestions, ...behavioural];
  for (let index = 0; questions.length < INTERVIEW_SET_MIN; index += 1) {
    questions.push(fromBank(index, `q_bank_${index}`));
  }
  questions = questions.slice(0, INTERVIEW_SET_MAX);

  const company = resume.targetCompany ?? draft?.company;
  return {
    id: setId,
    title: company ? `${company} — ${role}` : role,
    source: 'resume',
    resumeId: resume.id,
    questions,
    createdAt: now,
    ...(company ? { company } : {}),
    ...(draft ? { jdId: draft.id } : {}),
    ...(draft?.jobId ? { jobId: draft.jobId } : {}),
    ...(generationId ? { generationId } : {}),
    ...(input.regeneratedFromId ? { regeneratedFromId: input.regeneratedFromId } : {}),
  };
}
