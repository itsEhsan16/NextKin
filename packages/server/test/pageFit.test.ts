import { CANONICAL_SCHEMA_VERSION, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { describe, expect, it } from 'vitest';

import { dropOrder, fitToPages, type Measure } from '../src/pipeline/stages/pageFit';

/**
 * Fitting a tailored resume to its page budget (toreview §111.6). The measure here stands in for
 * the compiler: a page per `perPage` bullets, and each density step fits two more. Synthetic (L4).
 */

const line = (id: string, text: string) => ({ id, text, evidence: [], origin: 'user' as const });
const role = (roleId: string, start: string, texts: string[], entries?: CanonicalResumeJson['roles'][number]['entries']) => ({
  roleId,
  company: roleId,
  title: 'Engineer',
  start,
  end: null,
  skills: [],
  bullets: texts.map((t, i) => line(`${roleId}${i}`, t)),
  ...(entries ? { entries } : {}),
});

const DOC: CanonicalResumeJson = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  skills: [],
  roles: [
    role('now', '2024-06', ['Built the React booking flow', 'Ran the weekly demo', 'Wrote the Go payments API', 'Kept the wiki tidy']),
    role('intern', '2023-01', ['Fixed Go tests', 'Ordered team lunches', 'Answered support tickets'], [{ title: 'Support desk', bulletIds: ['intern2'] }]),
  ],
  education: [],
  certifications: [],
  projects: [],
};

const count = (doc: CanonicalResumeJson) => doc.roles.reduce((n, r) => n + r.bullets.length, 0);
function measure(perPage: number): Measure & { calls: number } {
  const m = Object.assign(async (doc: CanonicalResumeJson, density: number) => {
    m.calls++;
    return Math.ceil(count(doc) / (perPage + 2 * density));
  }, { calls: 0 });
  return m;
}

const fit = (perPage: number, mayTrim = true, m = measure(perPage)) =>
  fitToPages({ doc: DOC, budget: 1, mayTrim, order: dropOrder(DOC, new Set(['now']), ['React', 'Go']), measure: m, compiled: true });

describe('fitting compiled pages', () => {
  it('drops nothing when the resume already fits, at the template’s own spacing', async () => {
    expect(await fit(7)).toMatchObject({ density: 0, pages: 1, dropped: 0 });
  });

  it('tightens the spacing before it drops a line', async () => {
    expect(await fit(5)).toMatchObject({ density: 1, pages: 1, dropped: 0, doc: DOC });
  });

  it('drops the fewest lines, those naming none of the job’s skills, oldest role first', async () => {
    const result = await fit(1); // fits 5 bullets at density 2: two of seven go
    expect(result).toMatchObject({ density: 2, pages: 1, dropped: 2 });
    const kept = result.doc.roles.map((r) => r.bullets.map((b) => b.text));
    expect(kept[1]).toEqual(['Fixed Go tests']); // the intern role kept its one skill line
    expect(kept[0]).toHaveLength(4); // the recent role keeps three at least, and gave none up first
    // A client project whose only line went is gone with it.
    expect(result.doc.roles[1]!.entries ?? []).toEqual([]);
  });

  it('never drops below a role’s floor; if that cannot fit, it drops nothing', async () => {
    expect(dropOrder(DOC, new Set(['now']), ['React', 'Go'])).toEqual(['intern2', 'intern1', 'now3']);
    const never = Object.assign(async () => 2, { calls: 0 });
    expect(await fit(1, true, never)).toMatchObject({ dropped: 0, doc: DOC, density: 2 });
  });

  it('keeps every line when trimming is not allowed', async () => {
    expect(await fit(1, false)).toMatchObject({ dropped: 0, doc: DOC, density: 2, pages: 2 });
  });

  it('measures each candidate once', async () => {
    const m = measure(1);
    await fit(1, true, m);
    expect(m.calls).toBeLessThanOrEqual(8);
  });
});
