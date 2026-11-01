import { describe, expect, it } from 'vitest';

import type { AtsReport } from '../src/models/resume';
import { receiptClean, receiptSentence, scoreLead, summaryAfterLead, summaryFor } from '../src/models/resume';

/** What a score card leads with, and what's left to say after it (toreview §146.1). Synthetic. */

const match = (over: Partial<NonNullable<AtsReport['jdMatch']>>): AtsReport['jdMatch'] => ({
  percent: 50,
  requiredMet: 4,
  requiredPartial: 2,
  requiredTotal: 7,
  preferredMet: 1,
  preferredTotal: 3,
  completeness: 'full',
  ...over,
});

const report = (over: Partial<AtsReport>): AtsReport =>
  ({
    jdMatch: match({}),
    fixes: [],
    timeline: { checked: 0, valid: 0, suspect: 0, invalid: 0, unverified: 0, flags: [] },
    ...over,
  }) as AtsReport;

describe('scoreLead', () => {
  it('counts the required skills, then what is partly there and what is missing', () => {
    expect(scoreLead({ jdMatch: match({}) })).toEqual({
      headline: '4 of 7 required',
      detail: '2 partly · 1 missing',
    });
  });

  it('leaves out a count of nothing', () => {
    expect(scoreLead({ jdMatch: match({ requiredPartial: 0 }) })?.detail).toBe('3 missing');
    expect(scoreLead({ jdMatch: match({ requiredMet: 5 }) })?.detail).toBe('2 partly');
  });

  it('says so when every one is met', () => {
    const all = match({ requiredMet: 7, requiredPartial: 0 });
    expect(scoreLead({ jdMatch: all })).toEqual({
      headline: '7 of 7 required',
      detail: 'All of them met',
    });
  });

  it('counts the listed skills when the job marks none as required', () => {
    const none = match({ requiredMet: 0, requiredPartial: 0, requiredTotal: 0 });
    expect(scoreLead({ jdMatch: none })).toEqual({
      headline: '1 of 3 listed',
      detail: 'The job marks none as required',
    });
  });

  it('has nothing to lead with and no job to count against', () => {
    expect(scoreLead({ jdMatch: null })).toBeNull();
    expect(scoreLead(undefined)).toBeNull();
    const empty = match({ requiredTotal: 0, preferredTotal: 0, requiredMet: 0, requiredPartial: 0 });
    expect(scoreLead({ jdMatch: empty })).toBeNull();
  });
});

describe('the summary around the lead', () => {
  const backed = { type: 'surface_backed_skill', impact: 1.2 } as AtsReport['fixes'][number];

  it('still leads with the count on its own', () => {
    expect(summaryFor(report({ fixes: [backed] }))).toBe(
      'Meets 4 of 7 required skills, 2 partly. 1 skill your profile backs could add 1.2 points.',
    );
  });

  it('does not repeat the count under the lead', () => {
    expect(summaryAfterLead(report({ fixes: [backed] }))).toBe(
      '1 skill your profile backs could add 1.2 points.',
    );
  });

  it('has nothing to add when the lead says it all', () => {
    expect(summaryAfterLead(report({}))).toBe('');
  });
});

describe('the export receipt', () => {
  const clean = { sections: { found: 5, total: 5 }, bullets: { found: 23, total: 23 } };

  it('says what read back', () => {
    expect(receiptClean(clean)).toBe(true);
    expect(receiptSentence(clean)).toBe('We read it back: 5 of 5 sections, 23 of 23 bullets.');
  });

  it('leaves out bullets a resume does not have', () => {
    const none = { ...clean, bullets: { found: 0, total: 0 } };
    expect(receiptSentence(none)).toBe('We read it back: 5 of 5 sections.');
  });

  it('says so plainly when something did not read back', () => {
    const short = { ...clean, bullets: { found: 21, total: 23 } };
    expect(receiptClean(short)).toBe(false);
    expect(receiptSentence(short)).toBe('Only 21 of 23 bullets read back. Open the file and check it.');
    const section = { ...clean, sections: { found: 4, total: 5 } };
    expect(receiptSentence(section)).toBe('Only 4 of 5 sections read back. Open the file and check it.');
  });
});
