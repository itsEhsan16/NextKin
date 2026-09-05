import { atsBandFor, type AtsCheckItem, type AtsScore } from '@/data/models';
import {
  atsGaps,
  fixRowIds,
  fixRows,
  fixSectionLabel,
  mergeOrder,
  todoItems,
} from '@/features/resumes/atsFixRows';

/** An unmet, actionable check — what `atsQuickWins` returns. */
const win = (id: string, extra: Partial<AtsCheckItem> = {}): AtsCheckItem => ({
  id,
  label: `Missing: "${id}"`,
  passed: false,
  fixable: true,
  ...extra,
});

/** A JD keyword the profile does not back (V2 §7.8): shown, never inserted. */
const gap = (id: string): AtsCheckItem => ({
  id,
  label: `"${id}" is not in your profile`,
  passed: false,
  fixable: false,
  supported: false,
});

const scoreOf = (items: AtsCheckItem[], total = 70): AtsScore => ({
  total,
  band: atsBandFor(total),
  summary: 'Verdict.',
  sections: [{ key: 'keywords', label: 'Keywords', items }],
});

const ids = (rows: ReturnType<typeof fixRows>) => rows.map((row) => row.item.id);
const states = (rows: ReturnType<typeof fixRows>) => rows.map((row) => row.state);

describe('atsFixRows (V2 §7.8 — the fix list is not the quick-win list)', () => {
  it('reads the gaps off the sections, where atsQuickWins cannot see them', () => {
    const score = scoreOf([win('a'), gap('k8s')]);
    expect(atsGaps(score).map((item) => item.id)).toEqual(['k8s']);
    // Quick wins first, then the gaps — the order the screen seeds from.
    expect(fixRowIds(score)).toEqual(['a', 'k8s']);
    expect(fixRowIds(undefined)).toEqual([]);
  });

  it('holds first-seen order across a re-score that reshuffles the checks', () => {
    const first = scoreOf([win('a'), win('b'), win('c')]);
    const order = mergeOrder([], fixRowIds(first));
    expect(order).toEqual(['a', 'b', 'c']);

    // The fix on 'b' landed: it passes now, and the re-score hands the rest back in a new order.
    const after = scoreOf([win('c'), win('b', { passed: true }), win('a')], 74);
    const next = mergeOrder(order, fixRowIds(after));
    // Nothing new, so the SAME array comes back — the screen's effect must not loop on it.
    expect(next).toBe(order);

    const rows = fixRows({ score: after, applied: { b: win('b') }, order: next });
    expect(ids(rows)).toEqual(['a', 'b', 'c']);
  });

  it('keeps an applied item on the list as done instead of dropping it', () => {
    const before = scoreOf([win('a'), win('b')]);
    const order = mergeOrder([], fixRowIds(before));

    // 'a' passed, so it has left atsQuickWins entirely.
    const after = scoreOf([win('a', { passed: true }), win('b')], 74);
    const rows = fixRows({ score: after, applied: { a: win('a') }, order });

    expect(ids(rows)).toEqual(['a', 'b']);
    expect(states(rows)).toEqual(['done', 'todo']);
    expect(todoItems(rows).map((item) => item.id)).toEqual(['b']);
  });

  it('ticks a check some other fix carried over the line', () => {
    const order = mergeOrder([], fixRowIds(scoreOf([win('a'), win('b')])));
    // One edit settled both; only 'a' was ever applied through this screen.
    const after = scoreOf([win('a', { passed: true }), win('b', { passed: true })], 78);
    const rows = fixRows({ score: after, applied: { a: win('a') }, order });

    expect(states(rows)).toEqual(['done', 'done']);
    expect(todoItems(rows)).toEqual([]);
  });

  it('never offers an unsupported keyword as a fix', () => {
    const score = scoreOf([win('a'), gap('k8s')]);
    const order = mergeOrder([], fixRowIds(score));

    const rows = fixRows({ score, applied: {}, order });
    expect(states(rows)).toEqual(['todo', 'gap']);
    expect(todoItems(rows).map((item) => item.id)).toEqual(['a']);

    // A gap stays a gap even if something claimed to have applied it: nothing may insert one.
    const forced = fixRows({
      score,
      applied: { k8s: gap('k8s') },
      applyingId: 'k8s',
      order,
    });
    expect(forced.map((row) => row.state)).toEqual(['todo', 'gap']);
  });

  it('shows the in-flight fix as applying rather than todo', () => {
    const score = scoreOf([win('a'), win('b')]);
    const order = mergeOrder([], fixRowIds(score));
    const rows = fixRows({ score, applied: {}, applyingId: 'b', order });

    expect(states(rows)).toEqual(['todo', 'applying']);
    // An applying row is not offered to "Apply all" — it is already going.
    expect(todoItems(rows).map((item) => item.id)).toEqual(['a']);
  });

  it('renders rows before the order has caught up, and keeps a snapshot the score has lost', () => {
    const score = scoreOf([win('a')]);
    expect(ids(fixRows({ score, applied: {}, order: [] }))).toEqual(['a']);

    // No score at all (a document still loading): the session's own snapshot still lists.
    const rows = fixRows({ applied: { a: win('a') }, order: ['a'] });
    expect(states(rows)).toEqual(['done']);
  });

  it('names the section a fix lands in, including the one that is not a section', () => {
    expect(fixSectionLabel('skills')).toBe('Skills');
    expect(fixSectionLabel('experience')).toBe('Experience');
    // `links` is ResumeContent.links, not one of §7.11's six sections.
    expect(fixSectionLabel('links')).toBe('Links');
    expect(fixSectionLabel(undefined)).toBeUndefined();
  });
});
