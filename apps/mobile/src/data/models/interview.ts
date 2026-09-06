/**
 * NextKin V2 spec §7.15 — interview practice sets.
 *
 * A set is tied to the resume it was generated from: technical questions are drawn from skills
 * that resume actually claims, so the reader can defend every line of their own document. A set
 * with no resume behind it is the spec's standalone mode, built from a role title alone, and the
 * spec requires it to be *visibly* labelled as generic — `source: 'standalone'` is that flag.
 *
 * No artboard covers any of this (plan §8, phase 9I); the citations are spec sections.
 */

export type InterviewQuestionKind = 'behavioural' | 'technical';

export const INTERVIEW_QUESTION_KIND_LABEL: Record<InterviewQuestionKind, string> = {
  behavioural: 'Behavioural',
  technical: 'Technical',
};

/** §7.15's practice marks. Persisted on the set, not on the screen — they survive the session. */
export type InterviewMark = 'unmarked' | 'confident' | 'needs_work';

export const INTERVIEW_MARK_LABEL: Record<InterviewMark, string> = {
  unmarked: 'Not marked',
  confident: 'Confident',
  needs_work: 'Needs work',
};

export type InterviewQuestion = {
  id: string;
  kind: InterviewQuestionKind;
  prompt: string;
  /** §7.15's model answer. */
  answer: string;
  /** Talking points that name the reader's real content where there is any. */
  talkingPoints: string[];
  /** The resume-claimed skill a technical question is grounded in. */
  skill?: string;
  mark: InterviewMark;
};

/** §7.15's two modes. 'standalone' is the one the spec requires to be labelled generic. */
export type InterviewSetSource = 'resume' | 'standalone';

export type InterviewSet = {
  id: string;
  title: string;
  source: InterviewSetSource;
  /** The resume the questions were drawn from. Absent on a standalone set. */
  resumeId?: string;
  jdId?: string;
  jobId?: string;
  /** Standalone only: the title the set was written for. */
  roleTitle?: string;
  /** The run that produced it — how a finished generation finds its own set. */
  generationId?: string;
  /** Set when this set was regenerated from an earlier one. The earlier one is NOT deleted. */
  regeneratedFromId?: string;
  questions: InterviewQuestion[];
  /** ISO-8601 */
  createdAt: string;
};

/** The practice screen's filter: every question, or only the ones the reader flagged. */
export type InterviewPracticeFilter = 'all' | 'needs_work' | 'unmarked';

export const INTERVIEW_PRACTICE_FILTERS: readonly {
  key: InterviewPracticeFilter;
  label: string;
  marks?: readonly InterviewMark[];
}[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_work', label: 'Needs work', marks: ['needs_work'] },
  { key: 'unmarked', label: 'Not marked', marks: ['unmarked'] },
];

export function matchesPracticeFilter(
  mark: InterviewMark,
  filter: InterviewPracticeFilter,
): boolean {
  if (filter === 'all') return true;
  const entry = INTERVIEW_PRACTICE_FILTERS.find((item) => item.key === filter);
  return entry?.marks?.includes(mark) ?? false;
}

export type InterviewMarkCounts = {
  confident: number;
  needsWork: number;
  unmarked: number;
  marked: number;
  total: number;
};

/** The numbers a set's card and the practice header draw. */
export function interviewMarkCounts(set: Pick<InterviewSet, 'questions'>): InterviewMarkCounts {
  let confident = 0;
  let needsWork = 0;
  for (const question of set.questions) {
    if (question.mark === 'confident') confident += 1;
    else if (question.mark === 'needs_work') needsWork += 1;
  }
  const total = set.questions.length;
  const marked = confident + needsWork;
  return { confident, needsWork, unmarked: total - marked, marked, total };
}

/** §7.15: a standalone set is "clearly labeled as generic rather than JD-tailored". */
export const INTERVIEW_GENERIC_LABEL = 'Generic — not tailored to a job description';

/**
 * §7.15's explicit disclaimer, plus its ethics boundary. Binding on every interview surface:
 * the answers are preparation aids, not scripts, and the product does not help during a live
 * interview.
 */
export const INTERVIEW_DISCLAIMER =
  'These are preparation aids, not scripts. NextKin does not help during a live interview.';
