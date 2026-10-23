import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/canonical';
import { KB } from '../src/datasets/kb';
import { TAXONOMY } from '../src/datasets/taxonomy';
import { kbProblems, TECHNOLOGY_CATEGORIES, type KnowledgeBase } from '../src/kb';
import { skillById } from '../src/normalizer';
import { applySubstitution } from '../src/substitutions';
import { eraValidSkills, validateTimeline, violations, type TimelineRole } from '../src/timeline';
import { approvedKb, AS_OF } from './fixtures/documents';

const APPROVED = approvedKb();
const role = (id: string, endYear: number | null, skills: string[], startYear = 2005, text?: string): TimelineRole => ({
  id,
  start: { year: startYear, month: 1 },
  end: endYear === null ? null : { year: endYear, month: 12 },
  skills,
  ...(text ? { text } : {}),
});
const run = (roles: TimelineRole[], kb: KnowledgeBase = APPROVED, extra = {}) => validateTimeline({ roles, kb, taxonomy: TAXONOMY, asOf: AS_OF, ...extra });
const only = (roles: TimelineRole[], kb?: KnowledgeBase) => run(roles, kb).pairs[0]!;

describe('§16.2 case families', () => {
  it('used before its release year: Invalid, a hard fail that never ships', () => {
    const pair = only([role('r1', 2012, ['Kubernetes'])]);
    expect(pair).toMatchObject({ verdict: 'invalid', rule: 'ends_before_release', hardFail: true, included: false });
    expect(pair.kb).toMatchObject({ releaseYear: 2014, reviewState: 'admin_approved' });
  });

  it('after release but before the safe-usage year: Suspect, excluded by default', () => {
    expect(only([role('r1', 2014, ['Kubernetes'])])).toMatchObject({ verdict: 'suspect', rule: 'before_safe_usage', included: false, hardFail: false });
  });

  it('exactly on the boundary years', () => {
    // Kubernetes: release 2014, safe 2015.
    expect(only([role('r', 2013, ['Kubernetes'])]).verdict).toBe('invalid');
    expect(only([role('r', 2014, ['Kubernetes'])]).verdict).toBe('suspect');
    expect(only([role('r', 2015, ['Kubernetes'])]).verdict).toBe('valid');
    // Spring Boot: release = safe = 2014, so there is no suspect window.
    expect(only([role('r', 2013, ['Spring Boot'])]).verdict).toBe('invalid');
    expect(only([role('r', 2014, ['Spring Boot'])]).verdict).toBe('valid');
  });

  it('an unknown technology is flagged, never silently passed and never blocked', () => {
    const report = run([role('r', 2010, ['Blorbtech', 'CRM'])]);
    const byId = Object.fromEntries(report.pairs.map((p) => [p.skillId, p]));
    expect(byId['x:blorbtech']).toMatchObject({ verdict: 'unverified', rule: 'not_in_taxonomy', included: true, hardFail: false });
    expect(byId.crm).toMatchObject({ verdict: 'unverified', rule: 'not_in_kb', included: true });
    expect(report.reviewQueue).toEqual(['Blorbtech', 'CRM']);
  });

  it('a practice or design skill is not a technology claim and is not checked', () => {
    expect(run([role('r', 1990, ['Communication', 'User research', 'Agile'])]).pairs).toEqual([]);
  });

  it('overlapping employment: each role is judged on its own dates', () => {
    const report = run([role('old', 2012, ['Kubernetes'], 2008), role('new', 2018, ['Kubernetes'], 2011)]);
    expect(report.pairs.map((p) => [p.roleId, p.verdict])).toEqual([['old', 'invalid'], ['new', 'valid']]);
  });

  it('open-ended current roles end at asOf, which the report records', () => {
    const current = [role('now', null, ['Kubernetes'], 2010)];
    expect(validateTimeline({ roles: current, kb: APPROVED, taxonomy: TAXONOMY, asOf: { year: 2013 } }).pairs[0]!.verdict).toBe('invalid');
    const today = run(current);
    expect(today.pairs[0]!.verdict).toBe('valid');
    expect(today.asOf).toBe('2026-10');
  });

  it('KB version pinning: same input and same KB version give the same verdict, every time', () => {
    const input = [role('a', 2012, ['Kubernetes', 'Docker', 'Go']), role('b', null, ['React', 'Blorbtech'], 2013, 'Shipped Rust services')];
    const first = canonicalJson(run(input));
    for (let i = 0; i < 25; i += 1) expect(canonicalJson(run(input))).toBe(first);
  });

  it('a stored report is not rewritten by a later KB edit', () => {
    const input = [role('a', 2012, ['Kubernetes'])];
    const stored = run(input);
    const frozen = canonicalJson(stored);
    const edited = approvedKb({ kubernetes: { releaseYear: 2010, safeUsageYear: 2011 } });
    const later = run(input, { ...edited, version: 'kb-test-2' });
    expect(later.pairs[0]!.verdict).toBe('valid');
    expect(canonicalJson(stored)).toBe(frozen);
    expect(stored.kbVersion).toBe('kb-test-approved');
  });
});

describe('KB semantics (P8-03)', () => {
  it('a machine-generated entry cannot produce an Invalid verdict', () => {
    const pair = only([role('r', 2012, ['Kubernetes'])], KB);
    expect(pair).toMatchObject({ verdict: 'suspect', rule: 'ends_before_release_unapproved', hardFail: false, included: false });
  });

  it('holds for every machine-generated entry and every year', () => {
    const tech = KB.entries.map((e) => e.skillId);
    fc.assert(
      fc.property(fc.constantFrom(...tech), fc.integer({ min: 1960, max: 2030 }), (skillId, year) => {
        const name = skillById(TAXONOMY, skillId)!.name;
        const pairs = run([role('r', year, [name], 1950)], KB).pairs;
        return pairs.every((p) => p.verdict !== 'invalid' && !p.hardFail);
      }),
    );
  });

  it('the starter KB is consistent and entirely machine-generated technology', () => {
    expect(kbProblems(KB)).toEqual([]);
    for (const entry of KB.entries) {
      expect(entry.reviewState).toBe('machine_generated');
      const skill = skillById(TAXONOMY, entry.skillId);
      expect(skill, entry.skillId).toBeDefined();
      expect(TECHNOLOGY_CATEGORIES.has(skill!.category), entry.skillId).toBe(true);
    }
  });
});

describe('verdicts as properties', () => {
  const approved = APPROVED.entries;
  it('follow §7.7 exactly for every approved entry and end year', () => {
    fc.assert(
      fc.property(fc.constantFrom(...approved), fc.integer({ min: 1960, max: 2030 }), (entry, end) => {
        const name = skillById(TAXONOMY, entry.skillId)!.name;
        const verdict = run([role('r', end, [name], 1950)]).pairs.find((p) => p.skillId === entry.skillId)!.verdict;
        const expected = end < entry.releaseYear ? 'invalid' : end < entry.safeUsageYear ? 'suspect' : 'valid';
        return verdict === expected;
      }),
    );
  });

  it('never move backwards as a role ends later', () => {
    const order = { invalid: 0, suspect: 1, valid: 2, unverified: 3 };
    fc.assert(
      fc.property(fc.constantFrom(...approved), fc.integer({ min: 1960, max: 2029 }), (entry, end) => {
        const name = skillById(TAXONOMY, entry.skillId)!.name;
        const at = (year: number) => run([role('r', year, [name], 1950)]).pairs.find((p) => p.skillId === entry.skillId)!.verdict;
        return order[at(end)] <= order[at(end + 1)];
      }),
    );
  });

  it('do not depend on role order or on other roles', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(['Kubernetes', 'Docker', 'React', 'Go', 'Swift', 'Terraform'], { minLength: 1 }), fc.integer({ min: 2005, max: 2026 }), (skills, end) => {
        const alone = run([role('r', end, skills)]).pairs.map((p) => [p.skillId, p.verdict]);
        const withOther = run([role('x', 2001, ['Kubernetes'], 1999), role('r', end, [...skills].reverse())]).pairs
          .filter((p) => p.roleId === 'r')
          .map((p) => [p.skillId, p.verdict]);
        return JSON.stringify(alone) === JSON.stringify(withOther);
      }),
    );
  });
});

describe('the post-check, confirmations and the pre-filter', () => {
  it('reads technology mentions out of a role’s text', () => {
    const pair = only([role('r', 2011, [], 2008, 'Deployed services to Kubernetes clusters')]);
    expect(pair).toMatchObject({ skillId: 'kubernetes', source: 'text', verdict: 'invalid' });
    expect(violations(run([role('r', 2011, [], 2008, 'Deployed services to Kubernetes clusters')]))).toHaveLength(1);
  });

  it('a suspect claim is included only with a recorded confirmation; an invalid one never', () => {
    const roles = [role('r', 2014, ['Kubernetes']), role('q', 2012, ['Docker'])];
    const confirmations = [{ roleId: 'r', skillId: 'kubernetes' }, { roleId: 'q', skillId: 'docker' }];
    const report = run(roles, APPROVED, { confirmations });
    expect(report.pairs.find((p) => p.roleId === 'r')).toMatchObject({ verdict: 'suspect', confirmed: true, included: true });
    expect(report.pairs.find((p) => p.roleId === 'q')).toMatchObject({ verdict: 'invalid', confirmed: false, included: false });
  });

  it('the pre-filter hands the generator only era-valid skills per role', () => {
    const allowed = eraValidSkills({ roles: [role('old', 2011, ['Kubernetes', 'Docker', 'Linux', 'Puppet']), role('new', null, ['Kubernetes'], 2016)], kb: APPROVED, taxonomy: TAXONOMY, asOf: AS_OF });
    expect(allowed).toEqual({ old: ['linux', 'puppet'], new: ['kubernetes'] });
  });

  it('an undated role end is unverified, never guessed', () => {
    expect(only([{ id: 'r', start: { year: 2010 }, skills: ['Kubernetes'] }])).toMatchObject({ verdict: 'unverified', rule: 'role_end_unknown', roleEndYear: null });
  });
});

describe('substitutions (P8-05)', () => {
  it('suggest the candidate’s own valid skills first, then era-fitting relations', () => {
    const report = run([role('r', 2012, ['Kubernetes', 'Linux']), role('o', 2013, ['Chef'], 2011)]);
    const subs = report.pairs.find((p) => p.skillId === 'kubernetes')!.substitutions;
    expect(subs.map((s) => [s.skillId, s.source])).toEqual([['chef', 'own'], ['linux', 'own'], ['mesos', 'related'], ['puppet', 'related']]);
    expect(subs.every((s) => s.requiresConfirmation)).toBe(true);
  });

  it('a React claim on a 2009–2012 role suggests jQuery or Backbone (§7.7’s example)', () => {
    const subs = only([role('r', 2012, ['React'], 2009)]).substitutions.map((s) => s.name);
    expect(subs).toEqual(expect.arrayContaining(['jQuery', 'Backbone.js']));
  });

  it('are never written without an explicit confirmation', () => {
    const [sub] = only([role('r', 2012, ['React'], 2009)]).substitutions;
    expect(() => applySubstitution(['React'], 'React', sub!, undefined)).toThrow();
    expect(() => applySubstitution(['React'], 'React', sub!, { confirmed: 'yes' } as never)).toThrow();
    expect(applySubstitution(['React', 'CSS'], 'React', sub!, { confirmed: true })).toEqual(['CSS', sub!.name]);
  });
});
