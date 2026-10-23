import { describe, expect, it } from 'vitest';

import { TAXONOMY } from '../src/datasets/taxonomy';
import type { ScoringDocument, ScoringRole } from '../src/document';
import { bestRoleFor } from '../src/placement';
import { approvedKb, AS_OF } from './fixtures/documents';

/** Where a ticked skill is said (toreview §129, owner 2026-10-22). Synthetic. */

const ctx = { kb: approvedKb(), taxonomy: TAXONOMY, asOf: AS_OF };
const role = (id: string, start: number, end: number | null, skills: string[], bullets: string[] = []): ScoringRole => ({
  id,
  title: 'Engineer',
  company: id,
  start: { year: start, month: 1 },
  end: end === null ? null : { year: end, month: 12 },
  skills,
  bullets,
});
const doc = (roles: ScoringRole[]): ScoringDocument => ({ skills: [], roles, education: [], contact: { email: true, phone: false, location: false } });

describe('bestRoleFor', () => {
  it('a role whose work is related wins over a more recent unrelated one', () => {
    // React relates to Angular in the KB; the current role is a Python data job.
    const d = doc([role('data', 2023, null, ['Python', 'SQL']), role('web', 2019, 2022, ['Angular', 'TypeScript'])]);
    expect(bestRoleFor('React', d, ctx)).toBe('web');
  });

  it('with nothing related, the current role, then the later start', () => {
    const d = doc([role('old', 2016, 2019, ['Python']), role('now', 2020, null, ['Python']), role('also', 2021, 2024, ['Python'])]);
    expect(bestRoleFor('Kafka', d, ctx)).toBe('now');
  });

  it('never a role that ends before the technology existed, or before it was usable', () => {
    // Kubernetes: release 2014, safe usage 2015.
    const d = doc([role('early', 2008, 2013, ['Docker']), role('edge', 2012, 2014, ['Docker'])]);
    expect(bestRoleFor('Kubernetes', d, ctx)).toBeNull();
    expect(bestRoleFor('Kubernetes', doc([...d.roles, role('later', 2016, 2018, [])]), ctx)).toBe('later');
  });

  it('skips undated roles; an unknown skill goes where its words already are', () => {
    const undated: ScoringRole = { ...role('x', 2020, null, []), start: undefined };
    expect(bestRoleFor('Go', doc([undated]), ctx)).toBeNull();
    const d = doc([role('a', 2022, null, [], ['Shipped features']), role('b', 2018, 2021, [], ['Ran the blorbtech migration'])]);
    expect(bestRoleFor('Blorbtech', d, ctx)).toBe('b');
  });

  it('a role that already shows the skill is its place', () => {
    const d = doc([role('now', 2022, null, ['Go']), role('then', 2018, 2021, [], ['Built services in React'])]);
    expect(bestRoleFor('React', d, ctx)).toBe('then');
  });
});
