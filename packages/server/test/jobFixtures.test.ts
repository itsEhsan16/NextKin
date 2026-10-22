import { describe, expect, it } from 'vitest';

import { FIXTURE_CATALOGUE } from '../src/jobs/fixtures/catalogue';
import { fixtureCatalogue } from '../src/seed/jobFixtures';

/** P11-01: the fixture provider's catalogue is generated from the apps' boards and must not drift. */
describe('the fixture job catalogue', () => {
  it('matches what the board fixtures generate (run `pnpm --filter @nextkin/server fixtures:jobs` after changing them)', () => {
    const strip = (l: { postedAgoHours: number; closingInHours?: number }) => ({ ...l, postedAgoHours: Math.round(l.postedAgoHours), closingInHours: l.closingInHours == null ? undefined : Math.round(l.closingInHours) });
    expect(fixtureCatalogue().map(strip)).toEqual(FIXTURE_CATALOGUE.map(strip));
  });

  it('carries listing facts only: no saved state, picks, seeded match numbers or verified badges', () => {
    for (const listing of FIXTURE_CATALOGUE) {
      expect(Object.keys(listing).some((k) => /^(isSaved|savedAt|isPick|isTodaysPick|match|companyVerified|companyTagline)/.test(k))).toBe(false);
    }
  });
});
