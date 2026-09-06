import {
  interviewMarkCounts,
  matchesPracticeFilter,
  type InterviewMark,
  type InterviewMarkCounts,
  type InterviewPracticeFilter,
  type InterviewQuestion,
  type InterviewSet,
} from '@/data/models';

/**
 * NextKin V2 spec §7.15 — which question the practice screen shows, and why the filter is applied
 * against a SNAPSHOT of the marks rather than the live ones.
 *
 * The lesson `atsFixRows.ts` was written for, in a new coat: marking a question "needs work" while
 * the filter is "Not marked" would remove it from under the reader's finger and shift the deck.
 * So the filter reads the marks as they stood when it was chosen; a mark made during the pass
 * changes the card's control and the counts, and nothing else, until the reader picks a filter
 * again. Pure, so the index arithmetic is unit-tested without a mount.
 */
export type PracticeView = {
  /** The questions the current filter shows, in the set's own order. */
  questions: readonly InterviewQuestion[];
  /** Clamped into range, so a filter change can never land off the end. */
  index: number;
  current?: InterviewQuestion;
  total: number;
  counts: InterviewMarkCounts;
};

export type MarkSnapshot = Readonly<Record<string, InterviewMark>>;

/** The marks as they stand now, for `practiceView` to filter against on the next filter change. */
export const snapshotMarks = (set: Pick<InterviewSet, 'questions'>): MarkSnapshot =>
  Object.fromEntries(set.questions.map((question) => [question.id, question.mark]));

export function practiceView(
  set: Pick<InterviewSet, 'questions'> | undefined,
  filter: InterviewPracticeFilter,
  snapshot: MarkSnapshot,
  index: number,
): PracticeView {
  if (!set)
    return { questions: [], index: 0, total: 0, counts: interviewMarkCounts({ questions: [] }) };
  const questions = set.questions.filter((question) =>
    matchesPracticeFilter(snapshot[question.id] ?? question.mark, filter),
  );
  const clamped = questions.length === 0 ? 0 : Math.min(Math.max(index, 0), questions.length - 1);
  return {
    questions,
    index: clamped,
    current: questions[clamped],
    total: questions.length,
    counts: interviewMarkCounts(set),
  };
}

/** "Question 3 of 12" — the header line above the card. */
export const positionLine = (view: Pick<PracticeView, 'index' | 'total'>): string =>
  view.total === 0 ? 'No questions' : `Question ${view.index + 1} of ${view.total}`;

/** "6 confident · 2 need work · 4 to go" — the card on the list and the practice header. */
export function marksLine(counts: InterviewMarkCounts): string {
  const parts: string[] = [];
  if (counts.confident > 0) parts.push(`${counts.confident} confident`);
  if (counts.needsWork > 0)
    parts.push(`${counts.needsWork} ${counts.needsWork === 1 ? 'needs' : 'need'} work`);
  if (counts.unmarked > 0) parts.push(`${counts.unmarked} to go`);
  return parts.length > 0 ? parts.join(' · ') : 'Nothing marked yet';
}

/** Tapping the mark that is already set clears it, so two buttons are enough and none is inert. */
export const nextMark = (
  current: InterviewMark,
  pressed: Exclude<InterviewMark, 'unmarked'>,
): InterviewMark => (current === pressed ? 'unmarked' : pressed);
