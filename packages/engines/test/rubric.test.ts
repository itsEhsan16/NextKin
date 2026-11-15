import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/canonical';
import { TAXONOMY } from '../src/datasets/taxonomy';
import { isQuantified } from '../src/quantified';
import { score } from '../src/rubric';
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
    expect(score(backendInput()).stamp).toMatchObject({ engine: '1.2.0', rubric: 'rubric-3', taxonomy: { version: 'taxonomy-0.1.0' }, kb: { version: 'kb-0.1.0' }, asOf: '2026-10' });
  });

  it('no source file, field name or string claims a named third-party ATS', () => {
    const vendors = /workday|greenhouse|icims|taleo|lever\b|ats[- ]proof|beat (the )?ats|pass(es)? (the )?ats|ats[- ]friendly|ats[- ]compatible/i;
    const dir = join(import.meta.dirname, '../src');
    const files = readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.ts'));
    for (const file of files) expect(readFileSync(join(dir, file), 'utf8'), file).not.toMatch(vendors);
    expect(canonicalJson(score(backendInput()))).not.toMatch(vendors);
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
  ];
  it.each(counts)('counts "%s"', (bullet) => expect(isQuantified(bullet, TAXONOMY)).toBe(true));
  it.each(never)('never counts "%s"', (bullet) => expect(isQuantified(bullet, TAXONOMY)).toBe(false));
});
