import { factsOfDocument } from '@nextkin/shared/scoring/documentFacts';
import { holdOf, holdTerms } from '@nextkin/shared/scoring/keywordHold';
import { holdsWorth } from '@nextkin/shared/scoring/worth';
import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { describe, expect, it } from 'vitest';

import { scoringJdOfStage, worthAgainst } from '../src/pipeline/stages/persist';
import { bulletCap } from '../src/pipeline/stages/resume';
import { applyReview, type ReviewEdit } from '../src/pipeline/stages/reviewEdits';
import { mergeTailored, type TailorRunInput } from '../src/pipeline/stages/tailorMerge';
import { DEVICE_JD, RUN_A, RUN_B } from './fixtures/deviceTestingRuns';

/**
 * Two runs of one resume for one job (owner, 2026-11-25): an outside checker scored them 84 and 74.
 * The rubric cannot tell them apart; the keyword hold can, once the job's reading keeps the phrases
 * a checker counts. Synthetic employers and school (L4).
 */

const CONTACT = { email: true, phone: true, location: true };
const AS_OF = { year: 2026, month: 11 };
const worth = (document: CanonicalResumeJson) => worthAgainst({ document, facts: factsOfDocument(document), contact: CONTACT, jd: scoringJdOfStage(DEVICE_JD), asOf: AS_OF });
const JOB_SKILLS = [...DEVICE_JD.requiredSkills, ...DEVICE_JD.preferredSkills, ...DEVICE_JD.tools];
/** What prompt v9 of the job reading adds for this posting: the phrases the checker reported. */
const CHECKER_PHRASES = ['browser UI', 'Java Programming', 'Python Programming'];

describe('the two downloaded runs', () => {
  it('score the same on the rubric: it does not see what the checker saw', () => {
    expect(worth(RUN_B)).toEqual(worth(RUN_A));
  });

  it('hold the same phrases while the job’s reading lacks the ones the checker counted', () => {
    const terms = holdTerms({ skills: JOB_SKILLS, rawText: DEVICE_JD.rawText });
    expect(holdOf(RUN_B, terms).missing).toEqual(holdOf(RUN_A, terms).missing);
  });

  it('differ once the reading keeps those phrases: the 84 run says "browser UI", the 74 run does not', () => {
    const terms = holdTerms({ skills: [...JOB_SKILLS, ...CHECKER_PHRASES], rawText: DEVICE_JD.rawText });
    const [a, b] = [holdOf(RUN_A, terms), holdOf(RUN_B, terms)];
    expect(a.held).toBeGreaterThan(b.held);
    expect(a.missing).not.toContain('browser UI');
    expect(b.missing).toContain('browser UI');
    // Neither says "Java Programming": the checker reported it missing from both.
    expect(a.missing).toContain('Java Programming');
    expect(b.missing).toContain('Java Programming');
  });
});

describe('a review edit that costs a phrase', () => {
  const tailor: TailorRunInput = { baseResumeId: 'r', baseVersionId: 'v', fixes: ['summary', 'experience'], experience: 'full', added: [], skipped: [], baselineScore: 50 };
  const terms = holdTerms({ skills: [...JOB_SKILLS, ...CHECKER_PHRASES], rawText: DEVICE_JD.rawText });
  const holds = (before: CanonicalResumeJson, after: CanonicalResumeJson) => holdsWorth(worth(before), worth(after)) && holdOf(after, terms).held >= holdOf(before, terms).held;
  const ctx = { base: RUN_A, facts: factsOfDocument(RUN_A), tailor, asOf: AS_OF, holds };
  // The same summary with one of the job's phrases reworded, as the 74 run did.
  const LOOSER = RUN_A.summary!.text.replace('browser UI', 'the browser front end');
  const edit = (patch: Partial<ReviewEdit>): ReviewEdit => ({ op: 'summary', target: null, text: null, evidence: null, order: null, keep: null, reason: 'reads better', ...patch });

  it('is refused: a summary that rewords "browser UI" may not replace the one that says it', () => {
    const { doc, record } = applyReview(RUN_A, { issues: [], edits: [edit({ text: LOOSER, evidence: ['profile#summary'] })] }, ctx);
    expect(record.refused).toEqual([{ op: 'summary', target: null, why: 'lowers_score' }]);
    expect(doc.summary?.text).toBe(RUN_A.summary!.text);
  });

  it('is applied when it holds every phrase, and without a guard as before', () => {
    const better = `${RUN_A.summary!.text} Writes Reproduction Steps for every defect.`;
    expect(applyReview(RUN_A, { issues: [], edits: [edit({ text: better, evidence: ['profile#summary'] })] }, ctx).record.applied).toHaveLength(1);
    const unguarded = { base: ctx.base, facts: ctx.facts, tailor: ctx.tailor, asOf: ctx.asOf };
    expect(applyReview(RUN_A, { issues: [], edits: [edit({ text: LOOSER, evidence: ['profile#summary'] })] }, unguarded).record.applied).toHaveLength(1);
  });
});

describe('a rewritten role keeps the lines it would lose something by dropping', () => {
  const line = (id: string, text: string, evidence: string[] = [], origin: 'user' | 'generated' = 'user') => ({ id, text, evidence, origin });
  const base: CanonicalResumeJson = {
    ...RUN_A,
    summary: line('s0', 'Engineer.'),
    skills: [],
    roles: [
      {
        ...RUN_A.roles[0]!,
        bullets: [
          line('a', 'Ran regression checks on application enhancements'),
          line('b', 'Queried records with SQL to investigate discrepancies'),
          line('c', 'Kept the team wiki tidy'),
          line('d', 'Cut release checks from 3 days to 1 day'),
          line('e', 'Tested the device app with XCUI'),
        ],
      },
    ],
  };
  const generated: CanonicalResumeJson = { ...base, roles: [{ ...base.roles[0]!, bullets: [line('g0', 'Ran Device Testing regression checks with XCUI on application enhancements', ['now#r0'], 'generated')] }] };
  const request: TailorRunInput = { baseResumeId: 'r', baseVersionId: 'v', fixes: ['experience'], experience: 'full', added: [], skipped: [], baselineScore: 50 };
  const texts = (doc: CanonicalResumeJson) => doc.roles[0]!.bullets.map((b) => b.text);

  it('keeps an uncited line that names a job phrase the rewrite lacks, or holds a number', () => {
    const doc = mergeTailored({ base, generated, request, job: { title: DEVICE_JD.title, skills: JOB_SKILLS } });
    expect(texts(doc)).toEqual([
      'Ran Device Testing regression checks with XCUI on application enhancements',
      'Queried records with SQL to investigate discrepancies', // SQL: the job asks, the rewrite does not say it
      'Cut release checks from 3 days to 1 day', // a number
    ]);
    // "Kept the team wiki tidy" adds nothing; the XCUI line's phrase is already in the rewrite.
    expect(new Set(doc.roles[0]!.bullets.map((b) => b.id)).size).toBe(3);
  });

  it('leaves a line the candidate wrote a result into to its own rule, once', () => {
    const withFigure = { ...request, figures: [{ where: 'now', line: 3, text: 'Cut release checks from 3 days to 1 day, saving 40 hours a month' }] };
    const doc = mergeTailored({ base: { ...base, roles: [{ ...base.roles[0]!, bullets: base.roles[0]!.bullets.map((b, i) => (i === 3 ? { ...b, text: withFigure.figures[0]!.text } : b)) }] }, generated, request: withFigure, job: { title: DEVICE_JD.title, skills: JOB_SKILLS } });
    expect(texts(doc).filter((t) => t.startsWith('Cut release checks'))).toHaveLength(1);
  });

  it('keeps nothing extra without a job to ask', () => {
    const doc = mergeTailored({ base, generated, request, job: null });
    expect(texts(doc)).toEqual(['Ran Device Testing regression checks with XCUI on application enhancements', 'Cut release checks from 3 days to 1 day']);
  });
});

describe('how many bullets a role is written with (owner, 2026-11-25)', () => {
  const role = (lines: number, description?: string) => ({ responsibilities: Array.from({ length: lines }, (_, i) => `line ${i}`), ...(description ? { description } : {}) }) as never;

  it('a role of up to six lines keeps its count; a longer one keeps two in three, at most ten', () => {
    expect([1, 3, 6].map((n) => bulletCap(role(n)))).toEqual([1, 3, 6]);
    expect([7, 9, 12, 15, 24].map((n) => bulletCap(role(n)))).toEqual([6, 6, 8, 10, 10]);
    expect(bulletCap(role(0, 'Owned the platform.'))).toBe(3);
    expect(bulletCap(role(0))).toBe(0);
  });
});
