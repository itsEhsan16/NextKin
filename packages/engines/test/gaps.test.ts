import { describe, expect, it } from 'vitest';

import { detectGaps, MAX_SKILL_GAPS, type GapInput, type GapRole } from '../src/gaps';

/** Code decides what the interview asks (toreview §146.7). Synthetic. */

const role = (id: string, over: Partial<GapRole> = {}): GapRole => ({
  id,
  company: id,
  start: { year: 2020, month: 1 },
  end: { year: 2021, month: 1 },
  current: false,
  skills: ['Figma'],
  ...over,
});

const input = (over: Partial<GapInput>): GapInput => ({ roles: [], skills: [], education: [], ...over });

describe('detectGaps', () => {
  it('finds nothing in a complete profile', () => {
    const roles = [
      role('a', { end: { year: 2021, month: 1 } }),
      role('b', { start: { year: 2021, month: 2 }, end: null, current: true }),
    ];
    expect(detectGaps(input({ roles, skills: ['figma'] }))).toEqual([]);
  });

  it('asks about a role with no end that isn’t current, but never a current one', () => {
    expect(detectGaps(input({ roles: [role('a', { end: null })] }))).toEqual([{ kind: 'role_end', roleId: 'a' }]);
    expect(detectGaps(input({ roles: [role('a', { end: null, current: true })] }))).toEqual([]);
  });

  it('asks what a role with no skills used', () => {
    expect(detectGaps(input({ roles: [role('a', { skills: [] })] }))).toEqual([{ kind: 'role_skills', roleId: 'a' }]);
  });

  it('asks when an education has no year, unless it’s still going', () => {
    expect(detectGaps(input({ education: [{ id: 'e', end: null, current: false }] }))).toEqual([
      { kind: 'education_year', educationId: 'e' },
    ]);
    expect(detectGaps(input({ education: [{ id: 'e', end: null, current: true }] }))).toEqual([]);
  });

  it('finds a gap of more than three months between roles, in date order', () => {
    const roles = [
      role('later', { start: { year: 2023, month: 8 }, end: { year: 2024, month: 1 } }),
      role('earlier', { start: { year: 2021, month: 1 }, end: { year: 2023, month: 1 } }),
    ];
    expect(detectGaps(input({ roles }))).toEqual([
      { kind: 'date_gap', from: { year: 2023, month: 1 }, to: { year: 2023, month: 8 } },
    ]);
  });

  it('leaves a short break alone', () => {
    const roles = [role('a', { end: { year: 2021, month: 1 } }), role('b', { start: { year: 2021, month: 4 }, end: { year: 2022, month: 1 } })];
    expect(detectGaps(input({ roles }))).toEqual([]);
  });

  it('counts overlapping roles as covered', () => {
    const roles = [
      role('long', { start: { year: 2019, month: 1 }, end: { year: 2024, month: 1 } }),
      role('short', { start: { year: 2020, month: 1 }, end: { year: 2020, month: 6 } }),
      role('next', { start: { year: 2024, month: 2 }, end: { year: 2025, month: 1 } }),
    ];
    expect(detectGaps(input({ roles }))).toEqual([]);
  });

  it('won’t call a gap on year-only dates', () => {
    const roles = [role('a', { end: { year: 2019 } }), role('b', { start: { year: 2023 }, end: { year: 2024 } })];
    expect(detectGaps(input({ roles }))).toEqual([]);
  });

  it('asks where a listed skill was used, for a few skills at most', () => {
    const skills = ['Figma', 'Go', 'Rust', 'Zig', 'Elm', 'Nim'];
    const gaps = detectGaps(input({ roles: [role('a')], skills }));
    expect(gaps).toHaveLength(MAX_SKILL_GAPS);
    expect(gaps[0]).toEqual({ kind: 'skill_home', skill: 'Go' });
  });

  it('puts what a resume can’t state without it first', () => {
    const gaps = detectGaps(
      input({
        roles: [role('a', { end: null, skills: [] })],
        skills: ['Go'],
        education: [{ id: 'e', end: null, current: false }],
      }),
    );
    expect(gaps.map((g) => g.kind)).toEqual(['role_end', 'role_skills', 'education_year', 'skill_home']);
  });
});
