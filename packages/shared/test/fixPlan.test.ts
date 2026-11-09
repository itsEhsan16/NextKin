import { describe, expect, it } from 'vitest';

import type { ScoringDocument } from '@nextkin/engines/document';

import { PARSE_SAFE_TEMPLATE } from '../src/scoring/adapters';
import { scoreDocument, type DocumentScore } from '../src/scoring/report';
import { fixPlanOf, TAILOR_PATH, TARGET_SCORE } from '../src/scoring/fixPlan';

/** "Your fix plan" (toreview §115): where the points go, and each step's worth from the engine. */

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
    // Weights: required 2, preferred 1 → 2 + 2 + 1 = 5.
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

describe('fixPlanOf', () => {
  const plan = fixPlanOf({
    result,
    rawText: 'Strong Git workflows.\nJava is a plus.',
    improvements: [
      { key: 'summary', label: 'Summary', detail: 'Names neither the title nor Git.', ok: false },
      { key: 'years', label: 'Years of experience', detail: 'Asks 5; shows 1.', ok: false },
      { key: 'layout', label: 'Layout', detail: 'Fine', ok: true },
    ],
  })!;

  it('splits the score into what each part loses, biggest first', () => {
    expect(plan.score).toBe(6.2);
    expect(plan.parts.map((p) => [p.key, p.lost])).toEqual([
      ['keywords', 2],
      ['achievements', 1],
      ['sections', 0.3],
      ['timeline', 0],
      ['formatting', 0],
    ]);
  });

  it('prices each step as the engine would score it, unmeasured and unfixable last', () => {
    expect(plan.steps.map((s) => [s.kind, s.worth, s.who])).toEqual([
      // Git, required: 40 × 2/5 = 16 points of 100 when shown in a role → 1.6 of 10.
      ['keyword', 1.6, 'you'],
      // Java listed: the other half of 16 → 0.8.
      ['evidence', 0.8, 'you'],
      ['number', 0.3, 'you'],
      ['summary', null, 'ai'],
      ['years', null, 'nobody'],
    ]);
    expect(plan.steps[0]).toMatchObject({ title: 'Add Git', need: 'Strong Git workflows.', basis: '+0.8 in your skills, +1.6 when a role shows it — only if you have it' });
  });

  it('is undefined without a total (D-15)', () => {
    expect(fixPlanOf({ result: { report: { ...result.report, total: null } } as unknown as DocumentScore, improvements: [] })).toBeUndefined();
  });
});

describe('fixPlanOf with the path to the target (toreview §129; 10 since §202)', () => {
  const doc: ScoringDocument = {
    summary: 'Backend developer.',
    skills: ['Go'],
    roles: [
      { id: 'r_now', title: 'Backend Developer', company: 'Lumen Pay', start: { year: 2018, month: 1 }, end: null, skills: ['Go'], bullets: ['Built payment services in Go', 'Reviewed pull requests'] },
    ],
    education: [],
    contact: { email: true, phone: false, location: false },
  };
  const jd = { requiredSkills: ['Go', 'PostgreSQL', 'Kafka'], preferredSkills: ['Redis'], rawText: 'Go, PostgreSQL and Kafka required. Redis is a plus.', completeness: 'full' as const };
  const result = scoreDocument({ document: doc, format: PARSE_SAFE_TEMPLATE, asOf: { year: 2026, month: 10 }, jd, profile: doc, path: TAILOR_PATH });
  const plan = fixPlanOf({ result, rawText: jd.rawText, improvements: [] })!;

  it('says how far the plan goes, and real steps reach 10', () => {
    expect(plan.score).toBeLessThan(TARGET_SCORE);
    expect(plan.target).toMatchObject({ goal: TARGET_SCORE, reaches: true });
    expect(plan.target!.ceiling).toBe(TARGET_SCORE);
    const at = plan.target!.steps!;
    expect(plan.steps[at - 1]!.totalAfter).toBeGreaterThanOrEqual(TARGET_SCORE);
  });

  it('each step carries the running total, which only rises', () => {
    const totals = plan.steps.flatMap((s) => (s.totalAfter === undefined ? [] : [s.totalAfter]));
    expect(totals.length).toBeGreaterThan(2);
    expect([...totals].sort((a, b) => a - b)).toEqual(totals);
  });

  it('asks for real figures by bullet, and skills only as the user’s to confirm', () => {
    expect(plan.steps.filter((s) => s.kind === 'number').map((s) => s.bullet)).toEqual([
      { roleId: 'r_now', index: 0, text: 'Built payment services in Go' },
      { roleId: 'r_now', index: 1, text: 'Reviewed pull requests' },
    ]);
    expect(plan.steps.filter((s) => s.kind === 'keyword').every((s) => s.who === 'you')).toBe(true);
    expect(plan.steps[0]).toMatchObject({ kind: 'section', who: 'ai', title: 'Write a summary aimed at this job' });
  });
});
