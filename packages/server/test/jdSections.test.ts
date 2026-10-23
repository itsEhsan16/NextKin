import { describe, expect, it } from 'vitest';

import { verifySections } from '../src/pipeline/stages/jdSections';

/** A model's grouping of a JD (toreview §129): only lines the text says, verbatim, survive. */

const TEXT = [
  'Data Analyst',
  'We are a fintech startup helping 5,000 shops get paid faster. You will build dashboards and own our KPI reporting.',
  '- SQL and Python required',
  '- Experience with Looker is a plus',
  'We offer remote work and a learning budget. Salary $60k - $75k a year.',
].join('\n');

describe('verifySections', () => {
  it('keeps verbatim lines, drops invented or reworded ones and a heading the text lacks', () => {
    const { reading, dropped } = verifySections(TEXT, {
      sections: [
        { kind: 'about_company', heading: 'About us', lines: ['We are a fintech startup helping 5,000 shops get paid faster.'] },
        { kind: 'responsibilities', heading: null, lines: ['You will build dashboards and own our KPI reporting.', 'You will lead a team of ten.'] },
        { kind: 'requirements', heading: null, lines: ['- SQL and Python required'] },
        { kind: 'preferred', heading: null, lines: ['Experience with Looker is a plus'] },
        { kind: 'benefits', heading: null, lines: ['Free lunch every day'] },
      ],
    });
    expect(dropped).toBe(2);
    expect(reading.sections).toEqual([
      { kind: 'about_company', paragraphs: ['We are a fintech startup helping 5,000 shops get paid faster.'], items: [] },
      { kind: 'responsibilities', paragraphs: ['You will build dashboards and own our KPI reporting.'], items: [] },
      { kind: 'requirements', paragraphs: [], items: ['SQL and Python required'] },
      { kind: 'preferred', paragraphs: [], items: ['Experience with Looker is a plus'] },
    ]);
    expect(reading).toMatchObject({ by: 'model', confidence: 'strong', salary: '$60k - $75k a year', workArrangement: 'remote' });
  });

  it('a line used twice counts once; a grouping with one kind stays weak', () => {
    const { reading, dropped } = verifySections(TEXT, {
      sections: [
        { kind: 'requirements', heading: null, lines: ['SQL and Python required', 'SQL and Python required'] },
      ],
    });
    expect(dropped).toBe(1);
    expect(reading.confidence).toBe('weak');
  });
});
