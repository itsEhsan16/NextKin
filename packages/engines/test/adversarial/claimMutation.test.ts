/**
 * The adversarial suite, part 4: fabrications seeded into a known-good generated resume, caught by
 * the claim ledger (P9-04's done-when: ≥ 99%). The classes are the ones G13 names: employers,
 * titles, dates, degrees, certifications, numbers, years claims, technologies (unbacked and
 * anachronistic), uncited claims and achievements moved between roles. The rate is printed on
 * every run.
 */
import { describe, expect, it } from 'vitest';

import { buildClaimLedger } from '../../src/claims';
import { KB } from '../../src/datasets/kb';
import { TAXONOMY } from '../../src/datasets/taxonomy';
import type { CanonicalResume, Claim } from '../../src/facts';
import { skillById } from '../../src/normalizer';
import { approvedKb, AS_OF } from '../fixtures/documents';
import { FACTS, GOOD } from '../fixtures/facts';

const KB_OK = approvedKb();
type Mutation = { kind: string; doc: CanonicalResume; claimId: string };

const withBullet = (id: string, patch: Partial<Claim>): CanonicalResume => ({
  ...GOOD,
  roles: GOOD.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
});
const withRole = (roleId: string, patch: Partial<CanonicalResume['roles'][number]>): CanonicalResume => ({
  ...GOOD,
  roles: GOOD.roles.map((r) => (r.roleId === roleId ? { ...r, ...patch } : r)),
});
const bullets = GOOD.roles.flatMap((r) => r.bullets.map((b) => ({ roleId: r.roleId, bullet: b })));
const otherRole = (roleId: string) => GOOD.roles.find((r) => r.roleId !== roleId)!.roleId;

/** Technologies a role does not back, and ones newer than the 2012 role. */
const unbacked = ['Kafka', 'Terraform', 'React', 'MongoDB', 'Elasticsearch', 'Ansible', 'Jenkins', 'GraphQL', 'Scala', 'Rust developer tooling'.split(' ')[0]!];
const newer = KB.entries.filter((e) => e.releaseYear > 2012).map((e) => skillById(TAXONOMY, e.skillId)!.name);

const mutations: Mutation[] = [
  // Numbers: inflated, invented, and swapped scale.
  ...bullets.flatMap(({ bullet }) => [
    { kind: 'inflated number', doc: withBullet(bullet.id, { text: bullet.text.replace(/\d[\d,.]*/, (n) => String(Number(n.replace(/,/g, '')) * 7 + 3)) }), claimId: bullet.id },
    { kind: 'invented number', doc: withBullet(bullet.id, { text: `${bullet.text}, saving 37 hours a week` }), claimId: bullet.id },
  ]),
  // Moved between roles, uncited, and citing a fact that does not exist.
  ...bullets.flatMap(({ roleId, bullet }) => [
    { kind: 'moved between roles', doc: withBullet(bullet.id, { evidence: [`${otherRole(roleId)}#r0`] }), claimId: bullet.id },
    { kind: 'uncited', doc: withBullet(bullet.id, { evidence: [] }), claimId: bullet.id },
    { kind: 'phantom fact', doc: withBullet(bullet.id, { evidence: [`${roleId}#r42`] }), claimId: bullet.id },
  ]),
  // Technologies the role does not back, in each bullet.
  ...bullets.flatMap(({ bullet }) => unbacked.map((tech) => ({ kind: 'unbacked technology', doc: withBullet(bullet.id, { text: `${bullet.text} using ${tech}` }), claimId: bullet.id }))),
  // Technologies newer than the 2012 role, on that role.
  ...newer.map((tech) => ({ kind: 'anachronistic technology', doc: withBullet('b5', { text: `Maintained the catalogue schema with ${tech} and a team of 12` }), claimId: 'b5' })),
  // Headers: employer, title, start and end dates.
  ...GOOD.roles.flatMap((r) => [
    { kind: 'employer', doc: withRole(r.roleId, { company: `${r.company} Group` }), claimId: `header:${r.roleId}` },
    { kind: 'title upgrade', doc: withRole(r.roleId, { title: `Lead ${r.title}` }), claimId: `header:${r.roleId}` },
    { kind: 'start date', doc: withRole(r.roleId, { start: { year: r.start!.year - 2, month: r.start!.month } }), claimId: `header:${r.roleId}` },
    { kind: 'end date', doc: withRole(r.roleId, { end: r.end ? { year: r.end.year + 3, month: r.end.month } : { year: 2023, month: 1 } }), claimId: `header:${r.roleId}` },
  ]),
  // Summary: overstated years, invented totals, unbacked technology.
  { kind: 'years overstated', doc: { ...GOOD, summary: { ...GOOD.summary!, text: 'Backend engineer with 9 years of Go.' } }, claimId: 's' },
  { kind: 'years overstated', doc: { ...GOOD, summary: { ...GOOD.summary!, text: 'Backend engineer with 12 years of PostgreSQL.' } }, claimId: 's' },
  { kind: 'invented total', doc: { ...GOOD, summary: { ...GOOD.summary!, text: 'Backend engineer with 15 years in software.' } }, claimId: 's' },
  { kind: 'summary technology', doc: { ...GOOD, summary: { ...GOOD.summary!, text: 'Backend engineer working with Kafka and Terraform.' } }, claimId: 's' },
  // Skills, degree and certification.
  ...['Kafka', 'Terraform', 'Java', 'AWS', 'React'].map((name) => ({ kind: 'skill not in profile', doc: { ...GOOD, skills: [...GOOD.skills, { id: 'kx', name, text: name, evidence: ['r_pay'], origin: 'generated' as const }] }, claimId: 'kx' })),
  { kind: 'degree', doc: { ...GOOD, education: [{ factId: 'e_tu', institution: 'TU Example', degree: 'MSc Computer Science' }] }, claimId: 'education:e_tu' },
  { kind: 'institution', doc: { ...GOOD, education: [{ factId: 'e_tu', institution: 'TU Elsewhere', degree: 'BSc Computer Science' }] }, claimId: 'education:e_tu' },
  { kind: 'certification', doc: { ...GOOD, certifications: [{ factId: 'c_cka', name: 'Certified Kubernetes Security Specialist' }] }, claimId: 'certification:c_cka' },
];

describe('seeded fabrications against the claim ledger', () => {
  it('catches at least 99%, and says which slipped through', () => {
    const tally = new Map<string, { seeded: number; caught: number }>();
    const missed: string[] = [];
    for (const m of mutations) {
      const result = buildClaimLedger({ document: m.doc, facts: FACTS, taxonomy: TAXONOMY, kb: KB_OK, asOf: AS_OF }).results.find((r) => r.claimId === m.claimId);
      const caught = result?.status === 'violation';
      const t = tally.get(m.kind) ?? { seeded: 0, caught: 0 };
      t.seeded += 1;
      if (caught) t.caught += 1;
      else missed.push(`${m.kind}: ${m.claimId}`);
      tally.set(m.kind, t);
    }
    const caught = mutations.length - missed.length;
    console.log(`Claim-ledger catch rate: ${caught}/${mutations.length} (${((caught / mutations.length) * 100).toFixed(1)}%)\n${[...tally].map(([k, t]) => `  ${k}: ${t.caught}/${t.seeded}`).join('\n')}${missed.length ? `\nMissed:\n  ${missed.join('\n  ')}` : ''}`);
    expect(caught / mutations.length).toBeGreaterThanOrEqual(0.99);
  });

  it('the known-good resume raises nothing', () => {
    expect(buildClaimLedger({ document: GOOD, facts: FACTS, taxonomy: TAXONOMY, kb: KB_OK, asOf: AS_OF }).counts.violations).toBe(0);
  });
});
