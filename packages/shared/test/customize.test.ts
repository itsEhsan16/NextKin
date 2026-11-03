import { describe, expect, it } from 'vitest';

import type { TailorComparison } from '../src/models/tailor';
import type { FixPlan } from '../src/scoring/fixPlan';
import { initialChoices, keywordGroups, nothingChosen, projectedScore, setFigure, setFix, setPlace, statesResult, tailorRunInput, toggleAll, toggleKeyword } from '../src/tailor/customize';

/** The one Customize screen's state (toreview §114). Synthetic. */

const comparison: TailorComparison = {
  resumeId: 'r1',
  jdId: 'jd1',
  score: 59,
  pageCount: 1,
  improvements: [],
  keywords: [
    { label: 'React', onResume: true, source: 'required', top: true },
    { label: 'KYC', onResume: false, source: 'required', top: true },
    { label: 'Vue', onResume: false, source: 'description', top: true },
    { label: 'Fintech', onResume: false, source: 'description' },
    { label: 'teamwork', onResume: false, source: 'description', kind: 'soft' },
  ],
};

describe('the Customize choices', () => {
  it('start with every part on and nothing tapped', () => {
    const c = initialChoices();
    expect(c.added).toEqual([]);
    expect(c.fixes).toContain('projects');
    expect(nothingChosen(c)).toBe(false);
  });

  it('groups the missing keywords: top skills, soft skills, the rest', () => {
    const g = keywordGroups(comparison);
    expect([g.top, g.soft, g.more].map((l) => l.map((k) => k.label))).toEqual([['KYC', 'Vue'], ['teamwork'], ['Fintech']]);
  });

  it('taps, selects all, clears all, and forgets a place when a keyword is untapped', () => {
    let c = toggleKeyword(initialChoices(), 'KYC', true);
    c = setPlace(c, 'KYC', { where: ['web'], note: ' built checks ' });
    expect(c.places.KYC?.where).toEqual(['web']);
    c = toggleAll(c, ['KYC', 'Vue']);
    expect(c.added).toEqual(['KYC', 'Vue']);
    c = toggleAll(c, ['KYC', 'Vue']);
    expect(c.added).toEqual([]);
    expect(c.places).toEqual({});
  });

  it('builds the run: ticks added, the rest skipped, each place confirmed once', () => {
    let c = toggleKeyword(initialChoices(), 'KYC', true);
    c = setPlace(c, 'KYC', { where: ['web', 'project:p1', 'web'], note: ' built checks ' });
    c = setFix(c, 'summary', false);
    const input = tailorRunInput(comparison, c, 'job1');
    expect(input).toMatchObject({ kind: 'resume', jdId: 'jd1', jobId: 'job1', baseResumeId: 'r1' });
    expect(input.tailor).toMatchObject({
      sourceResumeId: 'r1',
      baselineScore: 59,
      sourcePages: 1,
      added: ['KYC'],
      skipped: ['Vue', 'Fintech', 'teamwork'],
      experience: 'full',
      confirmed: [
        { keyword: 'KYC', where: 'web', note: 'built checks' },
        { keyword: 'KYC', where: 'project:p1', note: 'built checks' },
      ],
    });
    expect(input.tailor?.fixes).not.toContain('summary');
  });
});

describe('figures and the projection (toreview §129)', () => {
  const plan: FixPlan = {
    score: 6.1,
    parts: [],
    target: { goal: 8.5, ai: 6.8, ceiling: 9.4, reaches: true, steps: 3 },
    steps: [
      { id: 'a', kind: 'section', title: 'Summary', have: '', worth: 0.7, basis: '', who: 'ai', totalAfter: 6.8 },
      { id: 'k', kind: 'keyword', title: 'Add KYC', have: '', worth: 1.2, basis: '', who: 'you', keyword: 'KYC', totalAfter: 8 },
      { id: 'e', kind: 'evidence', title: 'Show React', have: '', worth: 0.6, basis: '', who: 'you', keyword: 'React', totalAfter: 8.6 },
      { id: 'n', kind: 'number', title: 'Add the result', have: '', worth: 0.8, basis: '', who: 'you', bullet: { roleId: 'role_a', index: 1, text: 'Ran the onboarding checks' }, totalAfter: 9.4 },
    ],
  };

  it('counts a figure only once it states a result', () => {
    expect(statesResult('Ran the onboarding checks')).toBe(false);
    expect(statesResult('Ran the onboarding checks for 12,000 customers a month')).toBe(true);
  });

  it('adds the AI’s steps, then each answered step at its measured gain', () => {
    let c = initialChoices();
    expect(projectedScore(plan, c)).toBe(6.8);
    c = toggleKeyword(c, 'KYC', true);
    expect(projectedScore(plan, c)).toBe(7.4); // listed only: half of 1.2
    c = setPlace(c, 'KYC', { where: ['role_a'], note: '' });
    expect(projectedScore(plan, c)).toBe(8);
    c = setPlace(toggleKeyword(c, 'React', true), 'React', { where: ['role_a'], note: '' });
    expect(projectedScore(plan, c)).toBe(8.6);
    c = setFigure(c, 'role_a', 1, 'Ran the onboarding checks');
    expect(projectedScore(plan, c)).toBe(8.6);
    c = setFigure(c, 'role_a', 1, 'Ran the onboarding checks for 12,000 customers a month');
    expect(projectedScore(plan, c)).toBe(9.4);
    expect(projectedScore(undefined, c)).toBeUndefined();
  });

  it('sends the rewritten bullets with the run, and drops a cleared one', () => {
    let c = setFigure(initialChoices(), 'role_a', 1, ' Cut review time by 40% ');
    expect(tailorRunInput(comparison, c).tailor?.figures).toEqual([{ where: 'role_a', line: 1, text: 'Cut review time by 40%' }]);
    c = setFigure(c, 'role_a', 1, null);
    expect(tailorRunInput(comparison, c).tailor?.figures).toBeUndefined();
  });
});
