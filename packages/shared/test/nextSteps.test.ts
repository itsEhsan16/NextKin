import { describe, expect, it } from 'vitest';

import { nextStepsLine } from '../src/models/tailor';
import { NEXT_STEPS, nextStepsOf } from '../src/scoring/fixPlan';
import type { DocumentScore } from '../src/scoring/report';

/**
 * What is left after a run (toreview §206.3): only steps the candidate alone can take, each with
 * the gain the engine measured. Nothing the score does not measure is given a number.
 */

const result = {
  report: {
    total: 62,
    components: [
      { key: 'keywords', label: 'Keywords', weight: 40, score: 50, points: 20, basis: '5 of 10' },
      { key: 'timeline', label: 'Timeline', weight: 20, score: 100, points: 20, basis: 'all dated' },
      { key: 'sections', label: 'Sections', weight: 15, score: 80, points: 12, basis: 'summary short' },
      { key: 'formatting', label: 'Formatting', weight: 15, score: 100, points: 15, basis: 'clean' },
      { key: 'achievements', label: 'Achievements', weight: 10, score: 0, points: 0, basis: '0 of 6' },
    ],
    requirements: [
      { id: 'r1', text: 'Git', importance: 'required', status: 'gap', evidence: 'unbacked' },
      { id: 'r2', text: 'Java', importance: 'required', status: 'partial', evidence: 'listed' },
      { id: 'r3', text: 'React', importance: 'preferred', status: 'met', evidence: 'demonstrated' },
      { id: 'e1', text: 'A degree', importance: 'required', status: 'eligibility', evidence: null },
    ],
    fixes: [
      { id: 'n1', type: 'ask_for_number', label: 'Add a number to a bullet', impact: 3.3, insertable: false },
      { id: 'g1', type: 'gap', label: 'Git', impact: 0, insertable: false },
    ],
  },
} as unknown as DocumentScore;

describe('what is left after a run', () => {
  const next = nextStepsOf(result, 'Strong Git workflows.\nJava is a plus.');

  it('names the candidate’s own steps, each with a measured gain', () => {
    expect(next.length).toBeGreaterThan(0);
    expect(next.length).toBeLessThanOrEqual(NEXT_STEPS);
    expect(next.map((s) => s.title)).toEqual(expect.arrayContaining(['Add Git', 'Show Java in a role']));
    for (const step of next) expect(step.worth).toBeGreaterThan(0);
  });

  it('never lists a condition the score does not measure', () => {
    expect(next.some((s) => /degree/i.test(s.title))).toBe(false);
  });

  it('says nothing without a scored result', () => {
    expect(nextStepsOf(undefined)).toEqual([]);
    expect(nextStepsOf({ report: { ...result.report, total: null } } as unknown as DocumentScore)).toEqual([]);
  });

  it('makes one short line for the ready screen', () => {
    expect(nextStepsLine([{ title: 'Add Git', worth: 0.8 }, { title: 'Show Java in a role', worth: 0.4 }, { title: 'x', worth: 0.1 }])).toBe(
      'Next: Add Git (+0.8) · Show Java in a role (+0.4). Only if it’s true.',
    );
    expect(nextStepsLine([])).toBeNull();
    expect(nextStepsLine(undefined)).toBeNull();
  });
});
