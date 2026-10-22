import { describe, expect, it } from 'vitest';

import { jobFromJd } from '../src/jobs/fromJd';
import { arrangementIn, headingKind, linesOf, readJdSections, salaryIn } from '../src/jobs/jdSections';
import type { JdDraft } from '../src/models/jd';

/** A JD read into its own sections (toreview §129). Synthetic. */

const JD = [
  'Senior Frontend Engineer',
  'Acme Pay is hiring an engineer to build the checkout used by 2 million shoppers.',
  '',
  'About us:',
  'Acme Pay builds payment tools for small shops across Europe.',
  '',
  '## What you’ll do',
  '- Build the checkout in React and TypeScript',
  '- Work with designers on the component library',
  '',
  'Requirements',
  '• 5+ years of experience with React',
  '• Strong TypeScript',
  '',
  'Nice to have:',
  '- GraphQL',
  '',
  'What we offer',
  '- 30 days of paid leave',
  '- A yearly learning budget',
  '',
  'Compensation',
  'The base salary is €70,000 – €85,000 per year. This role is hybrid, in Berlin.',
  '',
  'How to apply',
  'Send your resume and a short note.',
].join('\n');

describe('reading a JD into its sections', () => {
  const reading = readJdSections(JD, 'Senior Frontend Engineer');

  it('finds each section by the JD’s own heading, in its order, and skips the title line', () => {
    expect(reading.sections.map((s) => [s.kind, s.heading ?? null])).toEqual([
      ['overview', null],
      ['about_company', 'About us'],
      ['responsibilities', 'What you’ll do'],
      ['requirements', 'Requirements'],
      ['preferred', 'Nice to have'],
      ['benefits', 'What we offer'],
      ['compensation', 'Compensation'],
      ['how_to_apply', 'How to apply'],
    ]);
    expect(reading.confidence).toBe('strong');
    expect(reading.by).toBe('rules');
  });

  it('keeps the lines as written, bullets without their marks', () => {
    expect(linesOf(reading, 'responsibilities')).toEqual(['Build the checkout in React and TypeScript', 'Work with designers on the component library']);
    expect(linesOf(reading, 'overview')).toEqual(['Acme Pay is hiring an engineer to build the checkout used by 2 million shoppers.']);
  });

  it('reads the pay range verbatim, and the arrangement', () => {
    expect(reading.salary).toBe('€70,000 – €85,000 per year');
    expect(reading.workArrangement).toBe('hybrid');
    expect(salaryIn('Pay: $45/hour')).toBe('$45/hour');
    expect(salaryIn('Competitive pay')).toBeUndefined();
    expect(arrangementIn('Fully remote team')).toBe('remote');
  });

  it('does not take "About you" or "About the role" for the company', () => {
    expect(headingKind('About you')).toBe('requirements');
    expect(headingKind('About the role:')).toBe('overview');
    expect(headingKind('About Acme')).toBe('about_company');
    expect(headingKind('A long sentence that happens to start the way a heading might, but is prose.')).toBeUndefined();
  });

  it('says it is weak when the text has too few headings to read by rule', () => {
    const wall = 'We need a React developer. You will build features and fix bugs. 3 years of experience. We offer a good salary and remote work.';
    const weak = readJdSections(wall);
    expect(weak.confidence).toBe('weak');
    expect(weak.sections).toEqual([{ kind: 'overview', paragraphs: [wall], items: [] }]);
  });
});

describe('the JD as a job (jobFromJd)', () => {
  const draft: JdDraft = {
    id: 'jd1',
    source: 'paste',
    title: 'Senior Frontend Engineer',
    requiredSkills: ['React'],
    preferredSkills: [],
    responsibilities: [],
    tools: [],
    rawText: JD,
    createdAt: '2026-10-21T00:00:00.000Z',
  };

  it('fills the description, benefits and company from the sections', () => {
    const { job, reading } = jobFromJd(draft);
    expect(job.description).toBe('Acme Pay is hiring an engineer to build the checkout used by 2 million shoppers.');
    expect(job.benefits).toEqual(['30 days of paid leave', 'A yearly learning budget']);
    expect(job.companyAbout).toBe('Acme Pay builds payment tools for small shops across Europe.');
    expect(job.remote).toBe('hybrid');
    expect(reading.by).toBe('rules');
  });

  it('prefers the server’s model reading when the draft carries one', () => {
    const reading = { sections: [{ kind: 'benefits' as const, paragraphs: [], items: ['Remote work'] }], confidence: 'strong' as const, by: 'model' as const };
    expect(jobFromJd({ ...draft, reading }).job.benefits).toEqual(['Remote work']);
  });
});
