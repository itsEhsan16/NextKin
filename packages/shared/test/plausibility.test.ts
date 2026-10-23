import { describe, expect, it } from 'vitest';

import type { ScoringDocument } from '@nextkin/engines/document';

import { jdPlausibility, resumePlausibility } from '../src/scoring/plausibility';
import { scoreDocument } from '../src/scoring/report';
import { PARSE_SAFE_TEMPLATE } from '../src/scoring/adapters';

const AS_OF = { year: 2026, month: 10 };

const DOC: ScoringDocument = {
  summary: 'Frontend engineer with 18 years of experience with React and component systems.',
  skills: ['React', 'TypeScript', 'CSS'],
  roles: [
    { id: 'r1', title: 'Engineer', company: 'Acme', start: { year: 2021, month: 3 }, end: { year: 2019, month: 1 }, skills: ['React'], bullets: ['Built the design system used by 40 teams'] },
  ],
  education: [{ institution: 'Example University', degree: 'BSc' }],
  contact: { email: true, phone: true, location: true },
};

describe('plausibility notes (§129)', () => {
  it('words a JD asking more years than the technology has existed', () => {
    const [note] = jdPlausibility({ requiredSkills: ['React'], preferredSkills: [], rawText: 'You bring 20+ years of experience with React.' }, AS_OF);
    expect(note).toMatchObject({ code: 'jd_years_exceed_tech_age', severity: 'suspect', skill: 'React', title: 'Asks for 20 years of React' });
    expect(note!.detail).toBe('React was released in 2013, so nobody can have more than about 13 years. We measure your React against 13 years instead.');
  });

  it('words a resume’s impossible years and backwards dates, naming the employer', () => {
    const notes = resumePlausibility(DOC, AS_OF);
    expect(notes.map((n) => n.title)).toEqual(['Says 18 years of React', 'Acme: the end date is before the start']);
    expect(notes[1]!.detail).toBe('It reads 2021-03 to 2019-01. Check the dates.');
  });

  it('travels on the score report, and is absent when nothing is wrong', () => {
    expect(scoreDocument({ document: DOC, format: PARSE_SAFE_TEMPLATE, asOf: AS_OF }).report.plausibility).toHaveLength(2);
    const clean = { ...DOC, summary: 'Frontend engineer building component systems.', roles: [{ ...DOC.roles[0]!, end: null }] };
    expect(scoreDocument({ document: clean, format: PARSE_SAFE_TEMPLATE, asOf: AS_OF }).report.plausibility).toBeUndefined();
  });
});
