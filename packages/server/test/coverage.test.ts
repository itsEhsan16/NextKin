import { describe, expect, it } from 'vitest';

import { coverageLines, coverageOf } from '../evals/coverage';

/**
 * The coverage check (toreview §211): a finished resume's text read the way an outside checker
 * reads it. The phrases are the ones a checker reported missing from the resume that started this
 * work, for an "AI-Native Product Manager – Graduate Trainee (2026 Passouts)" posting.
 */

const TITLE = 'AI-Native Product Manager – Graduate Trainee (2026 Passouts)';
const PHRASES = ['Software Development', 'Data analysis tools', 'Product analytics', 'Analytics Tools', 'Market Analysis', 'Customer calls', 'Product design', 'Stakeholder management'];

const GOOD = [
  TITLE,
  'Product-minded graduate with stakeholder management and software development experience.',
  'Skills: Product analytics, Analytics Tools, Data analysis tools, Market Analysis, Product design',
  'Ran 40 customer calls to decide what the next release fixed',
  'Cut onboarding from 5 days to 2 with a new checklist',
  'Grew weekly active users 30% after the pricing test',
  'Led a team of 6 on the campus marketplace',
  'Saved $2,000 a month by moving reports to one dashboard',
].join('\n');

describe('the coverage check', () => {
  it('passes a resume that names every phrase, the title as written, and five results', () => {
    const report = coverageOf({ text: GOOD, phrases: PHRASES, title: TITLE });
    expect(report).toMatchObject({ found: 8, total: 8, titleFound: true, results: 5, oddHyphens: 0, pass: true });
  });

  it('reads a look-alike hyphen as a different title, and counts it', () => {
    const report = coverageOf({ text: GOOD.replace('AI-Native', 'AI‐Native'), phrases: PHRASES, title: TITLE });
    expect(report).toMatchObject({ titleFound: false, oddHyphens: 1, pass: false });
  });

  it('names each missing phrase, matching whole words only', () => {
    const text = GOOD.replace('Market Analysis, ', '').replace('customer calls', 'customer callbacks');
    const report = coverageOf({ text, phrases: [...PHRASES, 'market analysis'], title: TITLE });
    expect(report.total).toBe(8);
    expect(report.phrases.filter((p) => !p.found).map((p) => p.phrase)).toEqual(['Market Analysis', 'Customer calls']);
    expect(coverageLines(report)).toEqual(expect.arrayContaining(['Keywords: 6 of 8 found', '  missing: Customer calls', 'FAIL']));
  });

  it('fails a resume with fewer than five measured results', () => {
    const text = GOOD.split('\n').slice(0, 5).join('\n');
    expect(coverageOf({ text, phrases: [], title: TITLE })).toMatchObject({ results: 2, pass: false });
  });
});
