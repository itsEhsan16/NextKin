import { interviewSetsFixture, subscriptionFixture } from '@/data/mock';
import { interviewAllowance, interviewSpentNote } from '@/features/interview/interviewQuota';
import {
  marksLine,
  nextMark,
  positionLine,
  practiceView,
  snapshotMarks,
} from '@/features/interview/practiceRows';

const seeded = () => {
  const [set] = interviewSetsFixture;
  if (!set) throw new Error('fixture empty');
  return set;
};

describe('interviewAllowance (V2 §13.3 — one set per resume)', () => {
  it('gates the resume that already has a set, and only that one', () => {
    const sets = [seeded()];
    const usage = subscriptionFixture.usage;
    expect(interviewAllowance(sets, 'res_2', usage)).toEqual({
      known: true,
      existing: 1,
      perTarget: 1,
      spent: true,
    });
    expect(interviewAllowance(sets, 'res_base', usage).spent).toBe(false);
  });

  it('meters standalone sets in their own bucket', () => {
    const sets = [
      seeded(),
      { ...seeded(), id: 'x', resumeId: undefined, source: 'standalone' as const },
    ];
    expect(interviewAllowance(sets, undefined, subscriptionFixture.usage).spent).toBe(true);
    expect(interviewAllowance([seeded()], undefined, subscriptionFixture.usage).spent).toBe(false);
  });

  it('treats an unread plan as unknown, not as unlimited and not as spent', () => {
    expect(interviewAllowance([seeded()], 'res_2', undefined)).toMatchObject({
      known: false,
      spent: false,
    });
  });

  it('never names a reset date, because this cap has none', () => {
    expect(interviewSpentNote(1, 'resume')).not.toMatch(/reset|tomorrow|next month/i);
    expect(interviewSpentNote(1, 'resume')).toContain('one question set per resume');
  });
});

describe('practiceView (V2 §7.15 practice mode)', () => {
  it('filters against the snapshot, so a mark made mid-pass does not shift the deck', () => {
    const set = seeded();
    const snapshot = snapshotMarks(set);
    const unmarked = practiceView(set, 'unmarked', snapshot, 0);
    expect(unmarked.total).toBe(set.questions.length - 3);

    // Mark the current question during the pass: the live set changes, the snapshot does not.
    const current = unmarked.current;
    if (!current) throw new Error('no current');
    const live = {
      questions: set.questions.map((q) =>
        q.id === current.id ? { ...q, mark: 'confident' as const } : q,
      ),
    };
    const after = practiceView(live, 'unmarked', snapshot, 0);
    expect(after.current?.id).toBe(current.id);
    expect(after.total).toBe(unmarked.total);
    // The counts, though, are live.
    expect(after.counts.confident).toBe(unmarked.counts.confident + 1);

    // A fresh snapshot on the next filter choice drops it.
    const refiltered = practiceView(live, 'unmarked', snapshotMarks(live), 0);
    expect(refiltered.total).toBe(unmarked.total - 1);
  });

  it('clamps the index so a filter change never lands off the end', () => {
    const set = seeded();
    const view = practiceView(set, 'needs_work', snapshotMarks(set), 99);
    expect(view.total).toBe(1);
    expect(view.index).toBe(0);
    expect(practiceView(set, 'all', snapshotMarks(set), -5).index).toBe(0);
    expect(practiceView(undefined, 'all', {}, 3)).toMatchObject({ total: 0, index: 0 });
  });

  it('words the header and the summary the way the list does', () => {
    const set = seeded();
    const view = practiceView(set, 'all', snapshotMarks(set), 2);
    expect(positionLine(view)).toBe(`Question 3 of ${set.questions.length}`);
    expect(marksLine(view.counts)).toBe(
      `2 confident · 1 needs work · ${set.questions.length - 3} to go`,
    );
    expect(marksLine({ confident: 0, needsWork: 0, unmarked: 4, marked: 0, total: 4 })).toBe(
      '4 to go',
    );
  });

  it('clears a mark when its own button is pressed again', () => {
    expect(nextMark('unmarked', 'confident')).toBe('confident');
    expect(nextMark('confident', 'confident')).toBe('unmarked');
    expect(nextMark('confident', 'needs_work')).toBe('needs_work');
  });
});
