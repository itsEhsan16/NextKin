/**
 * The adversarial suite, part 2: invariance and monotonicity (P8-09). Protected attributes change
 * nothing because the scorer never reads them; order and repetition change nothing; adding a backed
 * required skill never lowers the score and removing a matched one never raises it.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { ScoringDocument } from '../../src/document';
import { score, type ScoreResult } from '../../src/rubric';
import { backendInput, BACKEND_PROFILE, BACKEND_RESUME } from '../fixtures/documents';

/** Everything a score says, without the input fingerprint (which names the input). */
const verdict = (r: ScoreResult) => JSON.stringify({ ...r, contentFingerprint: undefined, copiedFromJd: undefined });
const run = (document: ScoringDocument) => score(backendInput({ document }));

const PROTECTED: readonly [string, Record<string, unknown>][] = [
  ['name', { name: 'Aisha Rahman' }],
  ['gender markers', { pronouns: 'she/her', gender: 'female' }],
  ['age signals', { dateOfBirth: '1968-03-02', age: 58 }],
  ['nationality', { nationality: 'Nigerian', citizenship: 'NG' }],
  ['a photo on an upload', { photo: true }],
  ['marital status', { maritalStatus: 'married' }],
];

describe('protected-attribute invariance', () => {
  it.each(PROTECTED)('%s changes nothing', (_label, extra) => {
    expect(verdict(run({ ...BACKEND_RESUME, ...extra } as ScoringDocument))).toBe(verdict(run(BACKEND_RESUME)));
  });

  it('the same markers written into the headline change nothing either', () => {
    const marked = { ...BACKEND_RESUME, headline: 'Aisha Rahman (she/her), born 1968, Nigerian national, married' };
    expect(run(marked).totalBps).toBe(run(BACKEND_RESUME).totalBps);
  });
});

describe('order and repetition invariance', () => {
  it('shuffling roles, skills and bullets changes nothing that is scored', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (roles, skills, bullets) => {
        const doc: ScoringDocument = {
          ...BACKEND_RESUME,
          skills: skills ? [...BACKEND_RESUME.skills].reverse() : BACKEND_RESUME.skills,
          roles: (roles ? [...BACKEND_RESUME.roles].reverse() : BACKEND_RESUME.roles).map((r) => ({
            ...r,
            bullets: bullets ? [...r.bullets].reverse() : r.bullets,
          })),
        };
        const a = run(BACKEND_RESUME);
        const b = run(doc);
        return a.totalBps === b.totalBps && JSON.stringify(a.components.map((c) => c.scoreBps)) === JSON.stringify(b.components.map((c) => c.scoreBps));
      }),
    );
  });
});

describe('monotonicity', () => {
  // Skills the profile backs on a dated role, as the JD names them.
  const backed = ['Go', 'PostgreSQL', 'Kubernetes', 'Docker', 'Redis', 'Terraform'];
  const docShowing = (shown: readonly string[]): ScoringDocument => ({
    ...BACKEND_PROFILE,
    skills: [...shown],
    roles: BACKEND_PROFILE.roles.map((r) => ({ ...r, skills: (r.skills ?? []).filter((s) => shown.includes(s)), bullets: [] })),
  });

  it('adding a backed required skill never lowers the score', () => {
    fc.assert(
      fc.property(fc.subarray(backed), fc.constantFrom(...backed), (shown, added) => {
        if (shown.includes(added)) return true;
        return run(docShowing([...shown, added])).totalBps! >= run(docShowing(shown)).totalBps!;
      }),
    );
  });

  it('removing a matched skill never raises the score', () => {
    fc.assert(
      fc.property(fc.subarray(backed, { minLength: 1 }), fc.nat(), (shown, pick) => {
        const removed = shown[pick % shown.length]!;
        return run(docShowing(shown.filter((s) => s !== removed))).totalBps! <= run(docShowing(shown)).totalBps!;
      }),
    );
  });
});
