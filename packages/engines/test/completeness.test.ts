import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FULL_BPS } from '../src/bps';
import { COMPLETENESS_WEIGHTS, profileCompleteness, type CompletenessInput } from '../src/completeness';

const empty: CompletenessInput = { links: 0, skills: 0, education: 0, certifications: 0, roles: [] };
const full: CompletenessInput = {
  headline: 'Designer',
  location: 'Berlin',
  phone: '+49 30 1234',
  links: 1,
  skills: 5,
  education: 1,
  certifications: 1,
  roles: [{ dated: true, skillTags: 3 }],
};

const input = fc.record({
  headline: fc.option(fc.string(), { nil: undefined }),
  location: fc.option(fc.string(), { nil: undefined }),
  phone: fc.option(fc.string(), { nil: undefined }),
  links: fc.nat(10),
  skills: fc.nat(30),
  education: fc.nat(5),
  certifications: fc.nat(5),
  roles: fc.array(fc.record({ dated: fc.boolean(), skillTags: fc.nat(10) }), { maxLength: 8 }),
});

describe('profile completeness (spec §7.3)', () => {
  it('weights sum to exactly 100% and experience items weigh most', () => {
    const weights = Object.values(COMPLETENESS_WEIGHTS);
    expect(weights.reduce((a, b) => a + b, 0)).toBe(FULL_BPS);
    const experience = COMPLETENESS_WEIGHTS.experience + COMPLETENESS_WEIGHTS.role_skills;
    for (const [key, weight] of Object.entries(COMPLETENESS_WEIGHTS)) {
      if (key !== 'experience' && key !== 'role_skills') expect(weight).toBeLessThan(experience);
    }
  });

  it('an empty profile is 0 and lists every item, heaviest first', () => {
    const result = profileCompleteness(empty);
    expect(result.bps).toBe(0);
    expect(result.missing.map((m) => m.key)).toEqual(['role_skills', 'experience', 'education', 'skills', 'headline', 'location', 'phone', 'links', 'certifications']);
  });

  it('a full profile is 100% with nothing missing', () => {
    expect(profileCompleteness(full)).toMatchObject({ bps: FULL_BPS, missing: [] });
  });

  it('role skills credit the share of dated roles that carry tags', () => {
    const half = profileCompleteness({ ...full, roles: [{ dated: true, skillTags: 2 }, { dated: true, skillTags: 0 }] });
    expect(half.items.find((i) => i.key === 'role_skills')?.earnedBps).toBe(1250);
    expect(half.missing[0]?.key).toBe('role_skills');
  });

  it('undated roles and whitespace-only fields earn nothing', () => {
    const result = profileCompleteness({ ...empty, headline: '   ', roles: [{ dated: false, skillTags: 4 }] });
    expect(result.bps).toBe(0);
  });

  it('skills scale to full credit at five and no further', () => {
    const at = (skills: number) => profileCompleteness({ ...empty, skills }).bps;
    expect([at(0), at(1), at(4), at(5), at(50)]).toEqual([0, 200, 800, 1000, 1000]);
  });

  it('property: always an integer in 0..100%, and equal to the sum of its items', () => {
    fc.assert(
      fc.property(input, (value) => {
        const result = profileCompleteness(value);
        expect(Number.isSafeInteger(result.bps)).toBe(true);
        expect(result.bps).toBeGreaterThanOrEqual(0);
        expect(result.bps).toBeLessThanOrEqual(FULL_BPS);
        expect(result.bps).toBe(result.items.reduce((s, i) => s + i.earnedBps, 0));
        expect(result.missing.every((m) => m.earnedBps < m.weightBps)).toBe(true);
      }),
    );
  });

  it('property: deterministic, and adding data never lowers it except by untagging roles', () => {
    fc.assert(
      fc.property(input, fc.nat(5), (value, extra) => {
        expect(profileCompleteness(value)).toEqual(profileCompleteness(structuredClone(value)));
        const more = { ...value, links: value.links + extra, skills: value.skills + extra, education: value.education + extra, certifications: value.certifications + extra };
        expect(profileCompleteness(more).bps).toBeGreaterThanOrEqual(profileCompleteness(value).bps);
      }),
    );
  });
});
