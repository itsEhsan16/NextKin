import { describe, expect, it } from 'vitest';

import { buildClaimLedger, stripHardFacts, violatingSections } from '../src/claims';
import { KB } from '../src/datasets/kb';
import { TAXONOMY } from '../src/datasets/taxonomy';
import type { CanonicalResume } from '../src/facts';
import { numbersIn } from '../src/numbers';
import { approvedKb, AS_OF } from './fixtures/documents';
import { FACTS, GOOD } from './fixtures/facts';

const ledger = (document: CanonicalResume, kb = approvedKb()) => buildClaimLedger({ document, facts: FACTS, taxonomy: TAXONOMY, kb, asOf: AS_OF });
const codesOf = (document: CanonicalResume, claimId: string) => ledger(document).results.find((r) => r.claimId === claimId)?.issues.map((i) => i.code) ?? [];
const editBullet = (id: string, patch: Partial<CanonicalResume['roles'][number]['bullets'][number]>): CanonicalResume => ({
  ...GOOD,
  roles: GOOD.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
});

describe('the claim ledger (P9-04)', () => {
  it('verifies the known-good resume claim by claim, with zero untraceable hard facts', () => {
    const result = ledger(GOOD);
    expect(result.results.filter((r) => r.status !== 'verified')).toEqual([]);
    expect(result.untraceableHardFacts).toBe(0);
  });

  it('allows whitelisted derivations: a percentage of two cited numbers, years from dates', () => {
    // 45% = (800 - 440) / 800; 6 years of Go and 10 years overall come from the role dates.
    expect(codesOf(GOOD, 'b2')).toEqual([]);
    expect(codesOf(GOOD, 's')).toEqual([]);
  });

  it('catches a number no fact states or derives', () => {
    expect(codesOf(editBullet('b4', { text: 'Built order APIs in Python serving 3,000 merchants' }), 'b4')).toContain('number_not_in_facts');
  });

  it('catches an achievement moved between roles', () => {
    expect(codesOf(editBullet('b4', { evidence: ['r_pay#r0'] }), 'b4')).toContain('moved_between_roles');
  });

  it('catches an uncited or wrongly cited claim', () => {
    expect(codesOf(editBullet('b1', { evidence: [] }), 'b1')).toContain('untraceable');
    expect(codesOf(editBullet('b1', { evidence: ['r_pay#r9'] }), 'b1')).toContain('untraceable');
  });

  it('catches a technology the role does not back, and one its dates rule out', () => {
    expect(codesOf(editBullet('b1', { text: 'Built the Go settlement service on Kafka handling 2M transactions a day' }), 'b1')).toContain('technology_not_backed');
    const codes = codesOf(editBullet('b5', { text: 'Ran the catalogue on Kubernetes with a team of 12' }), 'b5');
    expect(codes).toEqual(expect.arrayContaining(['technology_not_backed', 'anachronism']));
  });

  it('only an approved KB entry turns an early technology into a hard fail', () => {
    const doc = editBullet('b5', { text: 'Ran the catalogue on Kubernetes with a team of 12' });
    const withStarter = buildClaimLedger({ document: doc, facts: FACTS, taxonomy: TAXONOMY, kb: KB, asOf: AS_OF });
    // The starter KB only flags (suspect, excluded by default), so it still counts as not fitting.
    expect(withStarter.results.find((r) => r.claimId === 'b5')?.issues.map((i) => i.code)).toContain('anachronism');
  });

  it('holds titles, employers, dates and degrees to the profile', () => {
    const doc: CanonicalResume = {
      ...GOOD,
      roles: GOOD.roles.map((r) => (r.roleId === 'r_shop' ? { ...r, title: 'Lead Backend Engineer', start: { year: 2008, month: 1 } } : r)),
      education: [{ factId: 'e_tu', institution: 'TU Example', degree: 'MSc Computer Science' }],
    };
    expect(codesOf(doc, 'header:r_shop')).toEqual(expect.arrayContaining(['entity_mismatch', 'date_mismatch']));
    expect(codesOf(doc, 'education:e_tu')).toEqual(['entity_mismatch']);
  });

  it('checks "N years of X" against the dated roles that carry X', () => {
    const doc = { ...GOOD, summary: { ...GOOD.summary!, text: 'Backend engineer with 8 years of Go.' } };
    expect(codesOf(doc, 's')).toContain('years_overstated');
  });

  it('flags a verb stronger than the facts, without stripping it', () => {
    const result = ledger(editBullet('b4', { text: 'Led order API work in Python for 300 merchants' }));
    expect(result.results.find((r) => r.claimId === 'b4')).toMatchObject({ status: 'flagged', issues: [{ code: 'verb_stronger_than_facts', severity: 'soft' }] });
  });

  it('warns about user claims and never strips them; assumed claims are held for review', () => {
    const doc = editBullet('b4', { text: 'Built order APIs in Python serving 3,000 merchants', origin: 'user' });
    const result = ledger(doc);
    expect(result.results.find((r) => r.claimId === 'b4')?.status).toBe('user_warned');
    expect(stripHardFacts(doc, result, FACTS).document.roles[1]!.bullets.map((b) => b.id)).toContain('b4');
    expect(ledger(editBullet('b4', { origin: 'assumed' })).results.find((r) => r.claimId === 'b4')?.status).toBe('assumed');
  });

  it('holds a tailored run to the keywords the user left out, by skill or as whole words', () => {
    const doc: CanonicalResume = {
      ...editBullet('b4', { text: 'Built order APIs in Python serving 300 merchants, with stakeholder management' }),
      skills: [...GOOD.skills, { id: 'k-own', name: 'Python', text: 'Python', evidence: [], origin: 'user' }],
    };
    const result = buildClaimLedger({ document: doc, facts: FACTS, taxonomy: TAXONOMY, kb: approvedKb(), asOf: AS_OF, leftOut: ['Stakeholder management', 'python'] });
    const left = (id: string) => result.results.find((r) => r.claimId === id)?.issues.filter((i) => i.code === 'left_out_by_user').map((i) => i.detail) ?? [];
    expect(left('b4')).toEqual(['"Stakeholder management" was left out by the user', '"python" was left out by the user']);
    expect(result.results.find((r) => r.claimId === 'b4')?.status).toBe('violation');
    // The user's own lines are never held to it, and the choice is not an untraceable fact.
    expect(left('k-own')).toEqual([]);
    expect(result.untraceableHardFacts).toBe(0);
    expect(stripHardFacts(doc, result, FACTS).stripped.map((s) => s.claimId)).toContain('b4');
    expect(ledger(doc).results.find((r) => r.claimId === 'b4')?.status).toBe('verified');
  });

  it('strips invented hard facts and resets headers to the profile', () => {
    const doc: CanonicalResume = {
      ...editBullet('b4', { text: 'Built order APIs in Python serving 3,000 merchants' }),
      roles: editBullet('b4', { text: 'Built order APIs in Python serving 3,000 merchants' }).roles.map((r) => (r.roleId === 'r_pay' ? { ...r, title: 'Principal Engineer' } : r)),
      skills: [...GOOD.skills, { id: 'k9', name: 'Kafka', text: 'Kafka', evidence: ['r_pay'], origin: 'generated' }],
    };
    const result = ledger(doc);
    expect(violatingSections(result)).toEqual({ summary: false, skills: true, roleIds: ['r_pay', 'r_shop'] });
    const { document, stripped } = stripHardFacts(doc, result, FACTS);
    expect(stripped.map((s) => s.claimId).sort()).toEqual(['b4', 'header:r_pay', 'k9']);
    expect(document.roles[0]!.title).toBe('Senior Backend Engineer');
    expect(document.skills.map((s) => s.name)).not.toContain('Kafka');
    expect(ledger(document).untraceableHardFacts).toBe(0);
  });
});

describe('numbers as values', () => {
  it('reads scales, separators and number words, and skips years, versions and tech names', () => {
    expect(numbersIn('2M transactions, 2 million users, 40,000 rows, $1.2bn, three squads', TAXONOMY).map((n) => n.value)).toEqual([2e6, 2e6, 40000, 1.2e9, 3]);
    expect(numbersIn('Since 2019 on Python 3 with S3, EC2 and v2.1, in Q3, from 03/2020', TAXONOMY)).toEqual([]);
  });
});
