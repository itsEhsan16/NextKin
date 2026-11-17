import { describe, expect, it } from 'vitest';

import { figureLine } from '../src/models/tailor';
import { tailoringSchema } from '../src/schemas/generation';
import {
  ACCEPTED_MAX,
  CLAIM_TEXT_MAX,
  CONFIRMED_MAX,
  FIGURE_AMOUNT_MAX,
  FIGURE_DRAFT_MAX,
  FIGURE_TEXT_MAX,
  FIGURE_TYPED_MAX,
  FIGURES_MAX,
  JD_SKILLS_MAX,
  MAX_SKILLS,
  OWN_SKILLS,
  PLACES_PER_KEYWORD,
} from '../src/schemas/limits';
import { claimSchema } from '../src/schemas/resumeContent';
import { initialChoices, runProblem, startErrorLine, tailorRunInput } from '../src/tailor/customize';

/**
 * The sizes of a tailored run agree with one another (toreview §212.5): whatever one step can
 * produce, the next accepts. Three of these disagreed and each stopped a run on the demo: 60
 * stored skills against 80 accepted, 300 characters for a result line against a 440-character
 * suggestion, and 80 accepted keywords against a job that lists 100.
 */
describe('the sizes of a tailored run hold together', () => {
  it('every keyword a job can list can be accepted, and a resume holds them beside its own', () => {
    expect(ACCEPTED_MAX).toBeGreaterThanOrEqual(JD_SKILLS_MAX);
    expect(MAX_SKILLS).toBeGreaterThanOrEqual(OWN_SKILLS + ACCEPTED_MAX);
    expect(CONFIRMED_MAX).toBeGreaterThanOrEqual(ACCEPTED_MAX * PLACES_PER_KEYWORD);
  });

  it('the longest line the AI can suggest, and the longest the candidate can type into it, fit a stored line', () => {
    const draft = { before: 'x'.repeat(FIGURE_DRAFT_MAX - 1), after: '.' };
    expect(FIGURE_AMOUNT_MAX).toBeLessThanOrEqual(FIGURE_TYPED_MAX);
    for (const amount of ['9'.repeat(FIGURE_AMOUNT_MAX), '9'.repeat(FIGURE_TYPED_MAX)]) {
      const line = figureLine(draft, amount);
      expect(line.length).toBeLessThanOrEqual(FIGURE_TEXT_MAX);
      expect(claimSchema.safeParse({ id: 'a', text: line, evidence: [], origin: 'user' }).success).toBe(true);
    }
    expect(FIGURE_TEXT_MAX).toBeLessThanOrEqual(CLAIM_TEXT_MAX);
  });

  it('the fullest run the screen can build is one the server accepts', () => {
    const added = Array.from({ length: ACCEPTED_MAX }, (_, i) => `keyword ${i}`);
    const places = Object.fromEntries(added.map((k) => [k, { where: ['r1', 'r2', 'project:p1'], note: '', by: 'ai' as const }]));
    const figures = Object.fromEntries(Array.from({ length: FIGURES_MAX }, (_, i) => [`role_${i}#${i % 12}`, `${'y'.repeat(FIGURE_TEXT_MAX - 8)} by 10%`]));
    const choices = { ...initialChoices(), added, places, figures };
    expect(runProblem(choices)).toBeNull();
    const input = tailorRunInput({ jdId: 'jd1', resumeId: 'res1', score: 50, keywords: added.map((label) => ({ label, onResume: false })) } as never, choices);
    const tailor = input.tailor!;
    const wire = { fixes: tailor.fixes, experience: tailor.experience, keywords: tailor.added, confirmed: tailor.confirmed, figures: tailor.figures };
    const parsed = tailoringSchema.safeParse(wire);
    expect(parsed.success ? [] : parsed.error.issues.map((i) => i.path.join('.'))).toEqual([]);
  });
});

describe('a run that cannot be sent says why (toreview §212.5)', () => {
  it('too long a result line, or too many keywords, is named before anything is sent', () => {
    const long = `${'z'.repeat(FIGURE_TEXT_MAX)} by 10%`;
    expect(runProblem({ ...initialChoices(), figures: { 'r1#0': long } })).toMatch(/One result line is too long \(\d+ characters; up to 600\)/);
    const many = Array.from({ length: ACCEPTED_MAX + 3 }, (_, i) => `k${i}`);
    expect(runProblem({ ...initialChoices(), added: many })).toMatch(/untick 3 to continue/);
    expect(runProblem(initialChoices())).toBeNull();
  });

  it('a refused request is told by the part the server names, never as a plain "try again"', () => {
    const refused = (path: string) => ({ code: 'VALIDATION_FAILED', details: [{ path, message: 'Too big' }] });
    expect(startErrorLine(refused('tailoring.figures.2.text'))).toBe('One of your result lines is too long. Shorten it and try again.');
    expect(startErrorLine(refused('tailoring.keywords'))).toMatch(/Too many keywords/);
    expect(startErrorLine(refused('tailoring.somethingNew'))).toMatch(/part of the request wasn’t accepted \(tailoring\.somethingNew\)/);
    // Anything that is not a refusal keeps the plain line.
    expect(startErrorLine(new Error('network'))).toBe('We couldn’t start tailoring. Try again.');
    expect(startErrorLine({ code: 'UNAVAILABLE', details: null }, 'Custom')).toBe('Custom');
  });
});
