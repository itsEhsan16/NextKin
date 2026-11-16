import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/canonical';
import { TAXONOMY } from '../src/datasets/taxonomy';
import { isQuantified } from '../src/quantified';
import type { ScoringDocument } from '../src/document';
import { requirementsFromJd } from '../src/requirements';
import { score, titleWords } from '../src/rubric';
import { planToTarget } from '../src/targetPlan';
import { approvedKb, backendInput, BACKEND_RESUME } from './fixtures/documents';

describe('the rubric and score (P8-07)', () => {
  it('re-scoring the same input under the same version returns an identical result', () => {
    const first = canonicalJson(score(backendInput()));
    for (let i = 0; i < 10; i += 1) expect(canonicalJson(score(backendInput()))).toBe(first);
  });

  it('weights come from the versioned rubric and sum to the total', () => {
    const result = score(backendInput({ rubricId: 'rubric-2' }));
    expect(result.components.map((c) => [c.key, c.weightBps])).toEqual([
      ['keywords', 4000],
      ['timeline', 2000],
      ['sections', 1500],
      ['formatting', 1500],
      ['achievements', 1000],
    ]);
    const sum = result.components.reduce((s, c) => s + (c.contributionBps ?? 0), 0);
    expect(Math.abs(sum - result.totalBps!)).toBeLessThanOrEqual(2);
    expect(result.total).toBe(89);
    expect(result.band).toBe('strong');
    expect(result.jdMatch).toMatchObject({ requiredMet: 4, requiredTotal: 5, completeness: 'full' });
  });

  it('an unresolved hard fail zeroes the timeline component', () => {
    const roles = BACKEND_RESUME.roles.map((r) => (r.id === 'role_shop' ? { ...r, start: { year: 2009, month: 1 }, end: { year: 2012, month: 6 } } : r));
    const doc = { ...BACKEND_RESUME, roles: roles.map((r) => (r.id === 'role_shop' ? { ...r, bullets: [...r.bullets, 'Ran the Kubernetes clusters'] } : r)) };
    const result = score(backendInput({ document: doc, kb: approvedKb() }));
    const timeline = result.components.find((c) => c.key === 'timeline')!;
    expect(result.timeline.unresolvedHardFails).toBeGreaterThan(0);
    expect(timeline.scoreBps).toBe(0);
    // With the starter (machine-generated) KB the same claim only flags: no hard fail.
    const flagged = score(backendInput({ document: doc })).components.find((c) => c.key === 'timeline')!;
    expect(flagged.scoreBps).toBeGreaterThan(0);
  });

  it('gives no total and no band without a JD (D-15), but still reports the four parts', () => {
    const result = score(backendInput({ jd: undefined }));
    expect(result.total).toBeNull();
    expect(result.totalBps).toBeNull();
    expect(result.band).toBeNull();
    expect(result.jdMatch).toBeNull();
    const keywords = result.components.find((c) => c.key === 'keywords')!;
    expect(keywords).toMatchObject({ scoreBps: null, contributionBps: null });
    expect(result.components.filter((c) => c.scoreBps !== null)).toHaveLength(4);
  });

  it('a gap is never insertable and carries no points; a backed skill cites the profile', () => {
    const lean = { ...BACKEND_RESUME, skills: ['Go', 'Docker'], roles: BACKEND_RESUME.roles.map((r) => ({ ...r, skills: ['Go'], bullets: r.bullets.filter((b) => !/Kubernetes|PostgreSQL|Docker/.test(b)) })) };
    const result = score(backendInput({ document: lean }));
    const gaps = result.fixes.filter((f) => f.type === 'gap');
    expect(gaps.map((g) => g.skillName).sort()).toEqual(['Kafka', 'gRPC']);
    expect(gaps.every((g) => g.type === 'gap' && g.impactBps === 0 && g.insertable === false)).toBe(true);
    const backed = result.fixes.find((f) => f.type === 'surface_backed_skill' && f.skillId === 'kubernetes');
    expect(backed).toMatchObject({ target: { roleId: 'role_pay' }, evidenceRoleIds: ['role_pay'] });
    expect(backed!.impactBps).toBeGreaterThan(0);
  });

  it('simulates each fix’s impact by re-scoring the edit', () => {
    const result = score(backendInput({ rubricId: 'rubric-2' }));
    const ask = result.fixes.find((f) => f.type === 'ask_for_number')!;
    expect(ask).toMatchObject({ roleId: 'role_shop', bulletIndex: 2 });
    expect(ask.impactBps).toBe(167);
  });

  it('a skill the document claims but the profile does not back is reported and earns nothing', () => {
    const doc = { ...BACKEND_RESUME, skills: [...BACKEND_RESUME.skills, 'Kafka'] };
    const result = score(backendInput({ document: doc }));
    expect(result.unbackedClaims.map((c) => c.skillId)).toEqual(['kafka']);
    expect(result.ledger.find((e) => e.skillId === 'kafka')).toMatchObject({ status: 'gap' });
    expect(result.total).toBe(score(backendInput()).total);
  });

  it('carries the provenance stamp', () => {
    expect(score(backendInput()).stamp).toMatchObject({ engine: '1.3.0', rubric: 'rubric-4', taxonomy: { version: 'taxonomy-0.1.0' }, kb: { version: 'kb-0.1.0' }, asOf: '2026-10' });
  });

  it('no source file, field name or string claims a named third-party ATS', () => {
    const vendors = /workday|greenhouse|icims|taleo|lever\b|ats[- ]proof|beat (the )?ats|pass(es)? (the )?ats|ats[- ]friendly|ats[- ]compatible/i;
    const dir = join(import.meta.dirname, '../src');
    const files = readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.ts'));
    for (const file of files) expect(readFileSync(join(dir, file), 'utf8'), file).not.toMatch(vendors);
    expect(canonicalJson(score(backendInput()))).not.toMatch(vendors);
  });
});

describe('the keyword part under the checker rubric (rubric-4, toreview §212)', () => {
  const text = 'Product Manager. Product management is the job: product management of the roadmap, product management with design. Needs SQL, PostgreSQL and leadership.';
  const jd = (title?: string) => ({
    requirements: requirementsFromJd({ requiredSkills: ['product management', 'SQL', 'PostgreSQL'], preferredSkills: [], softSkills: ['leadership'], rawText: text }, TAXONOMY),
    text,
    completeness: 'full' as const,
    ...(title ? { title } : {}),
  });
  const doc = (over: Partial<ScoringDocument>): ScoringDocument => ({ ...BACKEND_RESUME, headline: undefined, summary: BACKEND_RESUME.summary, skills: ['SQL', 'PostgreSQL', 'product management', 'leadership'], roles: [], projects: [], ...over });
  const keywords = (document: ScoringDocument, title?: string) => score(backendInput({ document, profile: undefined, jd: jd(title) })).components.find((c) => c.key === 'keywords')!;

  it('soft skills are scored on their own', () => {
    const without = keywords(doc({ skills: ['SQL', 'PostgreSQL', 'product management'] }));
    expect(without.basis).toMatchObject({ hardBps: 10_000, softBps: 0 });
    expect(keywords(doc({})).basis).toMatchObject({ hardBps: 10_000, softBps: 10_000 });
  });

  it('a term the job says three times is half at one mention, full at two', () => {
    expect(keywords(doc({})).basis).toMatchObject({ repeatedTerms: 1, repeatedFull: 0, repeatedHalf: 1 });
    const twice = keywords(doc({ projects: [{ name: 'Roadmap', bullets: ['Ran product management for the checkout roadmap'] }] }));
    expect(twice.basis).toMatchObject({ repeatedTerms: 1, repeatedFull: 1, repeatedHalf: 0 });
    expect(twice.scoreBps).toBe(10_000);
  });

  it('the job title is read in the headline and summary, brackets left out', () => {
    expect(titleWords('AI-Native Product Manager – Graduate Trainee (2026 Passouts)')).toEqual(['ai', 'nativ', 'product', 'manager', 'graduat', 'traine']);
    expect(keywords(doc({}), 'Product Manager (2026)').basis).toMatchObject({ titleWords: 2, titleFound: 0 });
    expect(keywords(doc({ headline: 'Product Manager' }), 'Product Manager (2026)').basis).toMatchObject({ titleWords: 2, titleFound: 2 });
  });

  it('a keyword written another way than the job writes it earns half until it is mirrored', () => {
    const entry = (skills: string[]) => score(backendInput({ document: doc({ skills }), profile: undefined, jd: jd() })).ledger.find((e) => e.skillId === 'postgresql')!;
    expect(entry(['SQL', 'Postgres'])).toMatchObject({ status: 'partial', creditBps: 5_000, wording: { jd: 'PostgreSQL', resume: 'Postgres' } });
    expect(entry(['SQL', 'Postgres', 'PostgreSQL'])).toMatchObject({ status: 'met', creditBps: 10_000 });
    const old = score(backendInput({ document: doc({ skills: ['SQL', 'Postgres'] }), profile: undefined, jd: jd(), rubricId: 'rubric-3' })).ledger.find((e) => e.skillId === 'postgresql')!;
    expect(old).toMatchObject({ status: 'met', creditBps: 10_000 });
  });

  it('every suggestion taken reaches the top', () => {
    const path = planToTarget(backendInput({ document: doc({ skills: ['SQL', 'Postgres'] }), profile: undefined, jd: jd('Product Manager') }), { targetBps: 10_000 })!;
    expect(path.steps.map((s) => s.action.type)).toEqual(expect.arrayContaining(['confirm_skill', 'match_title', 'mirror_wording']));
    // What is left is not a keyword: the fixture has no dated role and no line to carry a result.
    expect(path.steps.at(-1)!.totalAfterBps).toBe(path.ceilingBps);
    // Keywords 75 of 75: only the 10 for results and the dated-role check's share stay open.
    expect(path.ceilingBps).toBe(9_000);
  });
});

describe('results under the coverage rubric (rubric-3, D-25)', () => {
  const plain = (n: number) => Array.from({ length: n }, (_, i) => `Ran the weekly release for squad ${'abcdefgh'[i]}`);
  const role = (bullets: string[]) => ({ ...BACKEND_RESUME.roles[0]!, bullets });
  const part = (document: typeof BACKEND_RESUME, rubricId = 'rubric-3') => score(backendInput({ document, rubricId })).components.find((c) => c.key === 'achievements')!;

  it('five lines with a measured result is full marks, however many lines there are', () => {
    const five = ['Cut onboarding from 5 days to 2', 'Grew revenue 40%', 'Saved $1.2M a year', 'Led a team of 6 engineers', 'Served 10k requests per second'];
    const doc = { ...BACKEND_RESUME, roles: [role([...five, ...plain(6)])] };
    expect(part(doc)).toMatchObject({ scoreBps: 10_000, basis: { quantified: 5, bullets: 11, needed: 5 } });
    expect(part(doc, 'rubric-2').scoreBps).toBeLessThan(5_000);
  });

  it('a resume with fewer than five lines needs a result on each', () => {
    const doc = { ...BACKEND_RESUME, roles: [role(['Grew revenue 40%', ...plain(2)])] };
    expect(part(doc)).toMatchObject({ scoreBps: 3333, basis: { quantified: 1, bullets: 3, needed: 3 } });
  });

  it('project lines count beside role lines', () => {
    const doc = { ...BACKEND_RESUME, roles: [role(plain(3))], projects: [{ name: 'Ledger', bullets: ['Cut reconciliation from 3 hours to 20 minutes', 'Served 10k requests per second'] }] };
    expect(part(doc)).toMatchObject({ basis: { quantified: 2, bullets: 5, needed: 5 }, scoreBps: 4000 });
    expect(part(doc, 'rubric-2').basis).toMatchObject({ quantified: 0, bullets: 3 });
  });
});

describe('the quantified-outcome detector', () => {
  const counts = [
    'Cut onboarding from 5 days to 2',
    'Grew revenue 40%',
    'Saved $1.2M a year',
    'Led a team of 6 engineers',
    'Doubled weekly active users',
    'Served 10k requests per second',
    'Reduced p99 latency by 120 ms',
    'Built the component kit, adopted by three squads',
    'Mentored dozens of new hires',
    'Cut page weight, improving load time by 10%',
    'Grew sign-ups 3x in a quarter',
    'Onboarded 100 users in the first month',
    'Ran a 5-day design sprint',
    'Led a team of 6',
  ];
  const never = [
    'Migrated services to Python 3',
    'Upgraded to Java 8 and Angular 2+',
    'Stored assets in S3 and ran EC2 instances',
    'Rebuilt the site in HTML5',
    'Joined in 2019 and led the 2021 relaunch',
    'Delivered the Q3 roadmap',
    'Shipped v2.1 of the SDK',
    'Started 03/2020',
    'Seit 03.2020 im Team',
    'Ran K8s clusters',
    'One of the first designers on the team',
    // A number that measures nothing (toreview §212).
    'Scoped around performance, SEO, and accessibility, improving 10.',
    'Secured through role-based access control, improving role based access by 100.',
    'Shipped 12 and moved on',
  ];
  it.each(counts)('counts "%s"', (bullet) => expect(isQuantified(bullet, TAXONOMY)).toBe(true));
  it.each(never)('never counts "%s"', (bullet) => expect(isQuantified(bullet, TAXONOMY)).toBe(false));
});
