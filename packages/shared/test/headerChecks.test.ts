import { describe, expect, it } from 'vitest';

import { headerChecksFor, headerStatements, jobCityOf, withHeaderChoices } from '../src/scoring/headerChecks';

/** The header's own statements against one job (toreview §170). Synthetic people and places. */

const HEADER = {
  name: 'Sam Rivera',
  items: [
    { text: 'Muzaffarpur, Bihar, India' },
    { text: '+91 90000 00000' },
    { text: 'sam@example.com' },
    { text: 'Open to relocating to Lucknow' },
    { text: 'LinkedIn', url: 'https://linkedin.com/in/x' },
  ],
};

describe('header statements', () => {
  it('are the lines the user wrote about themselves, never contact', () => {
    expect(headerStatements(HEADER)).toEqual([{ index: 3, text: 'Open to relocating to Lucknow' }]);
  });

  it('reads the job city off its location line', () => {
    expect(jobCityOf('India - Pune')).toBe('Pune');
    expect(jobCityOf('Pune, Maharashtra')).toBe('Pune');
    expect(jobCityOf('Remote')).toBeUndefined();
    expect(jobCityOf(undefined)).toBeUndefined();
  });

  it('flags relocating to another city than the job, offering the job city', () => {
    expect(headerChecksFor(HEADER, { title: 'Java Developer', location: 'India - Pune' })).toEqual([
      { index: 3, text: 'Open to relocating to Lucknow', kind: 'relocation_elsewhere', suggestion: 'Open to relocating to Pune' },
    ]);
    expect(headerChecksFor(HEADER, { title: 'Java Developer', location: 'Lucknow' })).toEqual([]);
    expect(headerChecksFor(HEADER, { title: 'Java Developer' })).toEqual([]);
  });

  it('flags seeking a role the job is not', () => {
    const header = { name: 'x', items: [{ text: 'Seeking data analyst roles' }] };
    expect(headerChecksFor(header, { title: 'Java Full Stack Engineer' })).toEqual([{ index: 0, text: 'Seeking data analyst roles', kind: 'other_role' }]);
    expect(headerChecksFor(header, { title: 'Junior Data Analyst' })).toEqual([]);
  });

  it('applies the user’s choice only to a statement', () => {
    expect(withHeaderChoices(HEADER, [{ index: 3, action: 'remove' }, { index: 2, action: 'remove' }])!.items.map((i) => i.text)).toEqual([
      'Muzaffarpur, Bihar, India',
      '+91 90000 00000',
      'sam@example.com',
      'LinkedIn',
    ]);
    expect(withHeaderChoices(HEADER, [{ index: 3, action: 'replace', text: 'Open to relocating to Pune' }])!.items[3]).toEqual({ text: 'Open to relocating to Pune' });
  });
});
