import { describe, expect, it } from 'vitest';

import type { ScoringDocument } from '@nextkin/engines/document';

import { PARSE_SAFE_TEMPLATE } from '../src/scoring/adapters';
import { scoreDocument, type ScoringJd } from '../src/scoring/report';

/** Every fix says what it rests on, read off the same run (G17, toreview §146.2). Synthetic. */

const AS_OF = { year: 2026, month: 10 };

const ROLE = {
  id: 'r1',
  title: 'Designer',
  company: 'Acme',
  start: { year: 2021, month: 3 },
  end: { year: 2024, month: 1 },
};

const PROFILE: ScoringDocument = {
  summary: 'Product designer with five years of work on design systems for payment products.',
  skills: ['Figma', 'User research', 'Prototyping'],
  roles: [{ ...ROLE, skills: ['Figma'], bullets: ['Shipped a design system'] }],
  education: [{ institution: 'Example University', degree: 'BSc' }],
  contact: { email: true, phone: true, location: true },
};

// The resume leaves Figma out of the role the profile tags it at.
const DOCUMENT: ScoringDocument = {
  ...PROFILE,
  skills: ['User research', 'Prototyping', 'Sketch'],
  roles: [{ ...ROLE, skills: [], bullets: ['Shipped a design system'] }],
};

const JD: ScoringJd = {
  requiredSkills: ['Figma', 'Kubernetes'],
  preferredSkills: [],
  rawText: 'Figma and Kubernetes are required.',
  completeness: 'full',
};

const fixes = () =>
  scoreDocument({ document: DOCUMENT, profile: PROFILE, format: PARSE_SAFE_TEMPLATE, asOf: AS_OF, jd: JD })
    .report.fixes;

describe('what a fix rests on', () => {
  it('names the role the person tagged a skill at', () => {
    const fix = fixes().find((f) => f.type === 'surface_backed_skill' && f.skill === 'Figma');
    expect(fix?.basis).toBe('You tagged it at Acme.');
  });

  it('says a skill that nothing backs will not be added, and asks', () => {
    const fix = fixes().find((f) => f.type === 'gap' && f.skill === 'Kubernetes');
    expect(fix?.basis).toBe('Not in your profile, so we won’t add it. Have you used it?');
  });

  it('asks for the real figure rather than offering one', () => {
    const fix = fixes().find((f) => f.type === 'ask_for_number');
    expect(fix?.basis).toBe('This line has no measured result yet. Only you know the real one.');
  });

  it('gives every fix a basis', () => {
    expect(fixes().length).toBeGreaterThan(0);
    for (const fix of fixes()) expect(fix.basis).toBeTruthy();
  });

  it('carries the basis onto the lines the fix screen shows', () => {
    const { score } = scoreDocument({
      document: DOCUMENT,
      profile: PROFILE,
      format: PARSE_SAFE_TEMPLATE,
      asOf: AS_OF,
      jd: JD,
    });
    const items = score?.sections.flatMap((section) => section.items) ?? [];
    expect(items.find((item) => item.keyword === 'Figma')?.basis).toBe('You tagged it at Acme.');
    expect(items.find((item) => item.keyword === 'Kubernetes')?.basis).toMatch(/^Not in your profile/);
  });
});
