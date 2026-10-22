import { describe, expect, it } from 'vitest';

import { TAXONOMY } from '../src/datasets/taxonomy';
import { leftOutChecker } from '../src/leftOut';
import { checkProjectBullets, type ProjectFacts } from '../src/projectClaims';

/** A tailored project's bullets against its own lines (toreview §113). Synthetic. */

const PROJECT: ProjectFacts = {
  id: 'p1',
  name: 'LinkTrack - Link Analytics',
  lines: ['Built a real-time click dashboard in React for 200 users', 'Wrote the redirect service'],
  skills: ['React', 'PostgreSQL'],
};
const check = (bullets: { text: string; evidence: string[] }[], leftOut: string[] = []) =>
  checkProjectBullets(PROJECT, bullets, TAXONOMY, leftOutChecker(TAXONOMY, leftOut)).map((i) => [i.index, i.code]);

describe('tailored project bullets', () => {
  it('accepts a rewording that cites its own lines, numbers and stack', () => {
    expect(check([{ text: 'Built a real-time React analytics dashboard used by 200 users, backed by PostgreSQL', evidence: ['p1#p0'] }])).toEqual([]);
  });

  it('refuses a bullet with no citation, another project’s line, a new number, a new technology or a left-out keyword', () => {
    expect(
      check(
        [
          { text: 'Built the dashboard', evidence: [] },
          { text: 'Built the dashboard', evidence: ['p2#p0'] },
          { text: 'Built a dashboard for 5,000 users', evidence: ['p1#p0'] },
          { text: 'Built the redirect service in Go', evidence: ['p1#p1'] },
          { text: 'Built the dashboard with caching', evidence: ['p1#p0'] },
        ],
        ['caching'],
      ),
    ).toEqual([
      [0, 'no_evidence'],
      [1, 'cites_other'],
      [2, 'number_not_backed'],
      [3, 'technology_not_backed'],
      [4, 'not_requested'],
    ]);
  });
});
