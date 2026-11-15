import { describe, expect, it } from 'vitest';

import { bestFigureLine, type FigureDraft, type TailorComparison } from '../src/models/tailor';
import { acceptAll, allAccepted, initialChoices, setFigure, tailorRunInput, toggleKeyword } from '../src/tailor/customize';

/**
 * "Accept all suggestions" (owner, D-25, toreview §211): nothing starts accepted; one press takes
 * every keyword, every question and each line's suggested result. Synthetic.
 */

const comparison: TailorComparison = {
  resumeId: 'r1',
  jdId: 'jd1',
  score: 59,
  improvements: [],
  keywords: [
    { label: 'React', onResume: true, source: 'required' },
    { label: 'KYC', onResume: false, source: 'required' },
    { label: 'Customer calls', onResume: false, source: 'description' },
    { label: 'Stakeholder management', onResume: false, source: 'description', kind: 'soft' },
  ],
  picks: { KYC: ['role_a'] },
};
const questions = [{ keyword: 'Postman', where: 'role_b' }];

describe('accept all suggestions', () => {
  it('starts with nothing accepted', () => {
    expect(initialChoices().added).toEqual([]);
    expect(allAccepted(initialChoices(), comparison, questions)).toBe(false);
  });

  it('takes every missing keyword, soft skills included, each with the place picked for it', () => {
    const c = acceptAll(initialChoices(), comparison);
    expect(c.added).toEqual(['KYC', 'Customer calls', 'Stakeholder management']);
    expect(c.places.KYC).toMatchObject({ where: ['role_a'], by: 'ai' });
    expect(allAccepted(c, comparison)).toBe(true);
    expect(tailorRunInput(comparison, c).tailor?.skipped).toEqual([]);
  });

  it('answers every question yes, as the candidate’s own word', () => {
    const c = acceptAll(initialChoices(), comparison, { questions });
    expect(c.added).toContain('Postman');
    expect(c.places.Postman).toMatchObject({ where: ['role_b'], by: 'you' });
    expect(allAccepted(c, comparison, questions)).toBe(true);
  });

  it('takes a line’s suggested result only when it states one, and never over the candidate’s own', () => {
    const own = setFigure(initialChoices(), 'role_a', 0, 'Cut review time by 40%');
    const c = acceptAll(own, comparison, {
      lines: [
        { roleId: 'role_a', index: 0, text: 'Cut review time by 10%' },
        { roleId: 'role_a', index: 1, text: 'Ran the onboarding checks for 12,000 customers a month' },
        { roleId: 'project:p1', index: 0, text: 'Built the checkout' },
      ],
    });
    expect(c.figures).toEqual({ 'role_a#0': 'Cut review time by 40%', 'role_a#1': 'Ran the onboarding checks for 12,000 customers a month' });
  });

  it('keeps what the candidate already chose', () => {
    const c = acceptAll(toggleKeyword(initialChoices(), 'KYC', true), comparison);
    expect(c.added).toEqual(['KYC', 'Customer calls', 'Stakeholder management']);
    expect(c.places.KYC).toBeUndefined();
  });
});

describe('the AI’s best line for a result', () => {
  const draft: FigureDraft = { before: 'Built the checkout, improving', after: '.', hint: 'what improved', by: 'model' };

  it('is the first result at its smallest amount', () => {
    const options = [{ what: 'orders handled', before: 'Built the checkout handling', after: 'a month.', amounts: ['500+ orders', '2,000+ orders'] }];
    expect(bestFigureLine({ ...draft, options, suggestion: 'conversion by 5%' })).toBe('Built the checkout handling 500+ orders a month.');
  });

  it('is the one typical figure when there are no results to pick from', () => {
    expect(bestFigureLine({ ...draft, suggestion: 'conversion by 5%' })).toBe('Built the checkout, improving conversion by 5%.');
  });

  it('is nothing when the AI offered no figure', () => {
    expect(bestFigureLine({ ...draft, by: 'rules' })).toBeNull();
  });
});
