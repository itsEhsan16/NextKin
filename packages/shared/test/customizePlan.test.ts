import { describe, expect, it } from 'vitest';

import type { FixPlan, PlanStep } from '../src/scoring/fixPlan';
import {
  initialChoices,
  planGoalLine,
  shortOnYears,
  tickKeyword,
  togglePlace,
  toggleAll,
} from '../src/tailor/customize';

/** The plan's words and picks, which both apps show (toreview §129, §129.6). Synthetic. */

const step = (over: Partial<PlanStep>): PlanStep => ({
  id: 's',
  kind: 'keyword',
  title: 'A step',
  have: 'Not on your resume',
  worth: 1,
  basis: 'Because',
  who: 'you',
  ...over,
});

const plan = (over: Partial<FixPlan>): FixPlan => ({ score: 6.2, parts: [], steps: [], ...over });
const target = { goal: 8.5, ai: 7, ceiling: 8.8, reaches: true, steps: 2 };

describe('the plan’s headline', () => {
  it('counts the steps to the score they really reach', () => {
    const steps = [step({ totalAfter: 7.5 }), step({ totalAfter: 8.6 }), step({ totalAfter: 8.8 })];
    expect(planGoalLine(plan({ steps, target }))).toBe('2 steps to reach 8.6/10');
    expect(planGoalLine(plan({ steps, target: { ...target, steps: 1 } }))).toBe(
      '1 step to reach 7.5/10',
    );
  });

  it('says so when the resume is already there', () => {
    expect(planGoalLine(plan({ target: { ...target, steps: 0 } }))).toBe('Already above 8.5');
  });

  it('gives the honest ceiling when the goal is out of reach', () => {
    const short = { ...target, reaches: false, steps: null, ceiling: 7.4 };
    expect(planGoalLine(plan({ target: short }))).toBe('Best possible for this job: 7.4/10');
  });

  it('falls back to a count for a plan with no path', () => {
    expect(planGoalLine(plan({}))).toBe('Nothing measured is missing');
    expect(planGoalLine(plan({ steps: [step({}), step({})] }))).toBe('2 steps to improve');
  });
});

describe('shortOnYears', () => {
  const short = { ...target, reaches: false, steps: null };
  const years = step({ kind: 'years', who: 'nobody', worth: null });

  it('holds only when years the roles don’t show are what stops the plan', () => {
    expect(shortOnYears(plan({ target: short, steps: [years] }))).toBe(true);
    expect(shortOnYears(plan({ target: short, steps: [step({})] }))).toBe(false);
    expect(shortOnYears(plan({ target, steps: [years] }))).toBe(false);
    expect(shortOnYears(plan({ steps: [years] }))).toBe(false);
  });
});

describe('a tick and the places picked for it (toreview §163)', () => {
  const picks = { Go: ['role_1', 'project:p1'] };

  it('takes every picked place, marked as the AI’s', () => {
    const c = tickKeyword(initialChoices(), 'Go', true, picks);
    expect(c.added).toEqual(['Go']);
    expect(c.places.Go).toEqual({ where: ['role_1', 'project:p1'], note: '', by: 'ai' });
  });

  it('is a skills-list tick with no picks', () => {
    expect(tickKeyword(initialChoices(), 'Rust', true, picks).places).toEqual({});
    expect(tickKeyword(initialChoices(), 'Go', true).places).toEqual({});
  });

  it('forgets the places when it is unticked', () => {
    const on = tickKeyword(initialChoices(), 'Go', true, picks);
    const off = tickKeyword(on, 'Go', false, picks);
    expect(off.added).toEqual([]);
    expect(off.places).toEqual({});
  });

  it('an edit makes the set the user’s; none left is Skills only, still ticked', () => {
    let c = tickKeyword(initialChoices(), 'Go', true, picks);
    c = togglePlace(c, 'Go', 'role_2', true);
    expect(c.places.Go).toEqual({ where: ['role_1', 'project:p1', 'role_2'], note: '', by: 'you' });
    c = togglePlace(togglePlace(togglePlace(c, 'Go', 'role_1', false), 'Go', 'project:p1', false), 'Go', 'role_2', false);
    expect(c.places).toEqual({});
    expect(c.added).toEqual(['Go']);
  });

  it('applies to Select all, and Clear all takes the places back', () => {
    const on = toggleAll(initialChoices(), ['Go', 'Rust'], picks);
    expect(on.added).toEqual(['Go', 'Rust']);
    expect(Object.keys(on.places)).toEqual(['Go']);
    expect(toggleAll(on, ['Go', 'Rust'], picks).places).toEqual({});
  });
});
