import { describe, expect, it } from 'vitest';

import {
  hiddenPicksLine,
  jobClashes,
  jobFit,
  splitPicks,
  type FitJob,
  type FitPreferences,
} from '../src/models/jobFit';

const job = (over: Partial<FitJob> = {}): FitJob => ({ location: 'Bengaluru, India', remote: 'hybrid', ...over });
const prefs = (over: Partial<FitPreferences> = {}): FitPreferences => ({ locations: [], remote: 'any', ...over });
const salary = (min: number, max?: number, extra = {}) => ({ min, ...(max ? { max } : {}), currency: 'INR' as const, period: 'year' as const, ...extra });
const states = (labels: { kind: string; state: string }[]) => Object.fromEntries(labels.map((l) => [l.kind, l.state]));

describe('jobFit', () => {
  it('says nothing about what the candidate didn’t ask for', () => {
    expect(jobFit(job(), prefs())).toEqual([]);
  });

  it('reads the workplace against the preference', () => {
    expect(states(jobFit(job({ remote: 'onsite' }), prefs({ remote: 'remote' })))).toEqual({ workplace: 'clashes' });
    expect(states(jobFit(job({ remote: 'remote' }), prefs({ remote: 'hybrid' })))).toEqual({ workplace: 'fits' });
    expect(states(jobFit(job({ remote: 'remote' }), prefs({ remote: 'onsite' })))).toEqual({ workplace: 'clashes' });
    expect(jobClashes(job(), prefs({ remote: 'remote' }))).toEqual(['Hybrid, and you prefer remote']);
  });

  it('never clashes on a workplace the listing didn’t state', () => {
    const silent = job({ workplaceUnstated: true, remote: 'onsite' });
    expect(jobFit(silent, prefs({ remote: 'remote' }))).toEqual([{ kind: 'workplace', state: 'unknown', text: 'Workplace not stated' }]);
  });

  it('reads the location, including the other spelling, and skips it for remote jobs', () => {
    expect(states(jobFit(job(), prefs({ locations: ['Bangalore'] })))).toEqual({ location: 'fits' });
    expect(jobClashes(job({ location: 'Mumbai' }), prefs({ locations: ['Pune'] }))).toEqual(['In Mumbai, not one of your places']);
    expect(jobFit(job({ remote: 'remote', location: 'Anywhere' }), prefs({ locations: ['Pune'] }))).toEqual([]);
    expect(states(jobFit(job({ location: ' ' }), prefs({ locations: ['Pune'] })))).toEqual({ location: 'unknown' });
  });

  it('compares pay on its best case, in one currency, across periods', () => {
    const wants = prefs({ minSalary: { min: 2_400_000, currency: 'INR', period: 'year' } });
    expect(states(jobFit(job({ salary: salary(2_000_000, 2_600_000) }), wants))).toEqual({ salary: 'fits' });
    expect(jobClashes(job({ salary: salary(1_000_000, 2_000_000) }), wants)).toEqual(['Below your minimum salary']);
    expect(states(jobFit(job({ salary: { min: 210_000, currency: 'INR', period: 'month' } }), wants))).toEqual({ salary: 'fits' });
    expect(states(jobFit(job({ salary: { min: 90_000, currency: 'USD', period: 'year' } }), wants))).toEqual({ salary: 'unknown' });
    expect(states(jobFit(job(), wants))).toEqual({ salary: 'unknown' });
  });

  it('never lets an estimate rule a job out', () => {
    const wants = prefs({ minSalary: { min: 2_400_000, currency: 'INR', period: 'year' } });
    expect(jobClashes(job({ salary: salary(1_000_000, 2_000_000, { estimated: true }) }), wants)).toEqual([]);
  });
});

describe('splitPicks', () => {
  const wants = prefs({ remote: 'remote' });

  it('keeps the best that fit, and says what it passed over', () => {
    const ranked = [job({ remote: 'onsite' }), job({ remote: 'remote' }), job({ remote: 'hybrid' }), job({ remote: 'remote' })];
    const { kept, hidden } = splitPicks(ranked, wants, 10);
    expect(kept).toHaveLength(2);
    expect(hidden.count).toBe(2);
    expect(hiddenPicksLine(hidden)).toBe('2 hidden: On-site, and you prefer remote · Hybrid, and you prefer remote');
  });

  it('stops at the limit, so what lies below it isn’t counted', () => {
    const ranked = [job({ remote: 'remote' }), job({ remote: 'onsite' })];
    expect(splitPicks(ranked, wants, 1).hidden.count).toBe(0);
  });

  it('hides nothing a listing doesn’t state', () => {
    const ranked = [job({ remote: 'onsite', workplaceUnstated: true })];
    expect(splitPicks(ranked, wants, 10)).toMatchObject({ kept: ranked, hidden: { count: 0 } });
  });
});
