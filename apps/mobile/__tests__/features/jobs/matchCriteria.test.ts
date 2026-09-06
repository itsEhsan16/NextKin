import type { MatchCriterion } from '@/data/models';
import {
  criterionA11yLabel,
  groupMatchCriteria,
  matchPercentage,
  MATCH_HONESTY_NOTE,
} from '@/features/jobs/matchCriteria';

const criterion = (
  id: string,
  state: MatchCriterion['state'],
  detail?: string,
): MatchCriterion => ({
  id,
  label: `Criterion ${id}`,
  state,
  ...(detail ? { detail } : {}),
});

describe('matchPercentage (V2 §7.13)', () => {
  it('turns the stored fraction into the number the ring shows', () => {
    // job_stripe's own score.
    expect(matchPercentage(0.91)).toBe(91);
    expect(matchPercentage(0)).toBe(0);
    expect(matchPercentage(1)).toBe(100);
  });

  it('rounds to the nearest whole percent rather than truncating', () => {
    expect(matchPercentage(0.914)).toBe(91);
    expect(matchPercentage(0.915)).toBe(92);
    expect(matchPercentage(0.005)).toBe(1);
    // Float noise from the fixtures (0.7 * 100 is 70.00000000000001) must not leak into the ring.
    expect(matchPercentage(0.7)).toBe(70);
  });

  it('clamps anything the ring could not draw', () => {
    expect(matchPercentage(-0.4)).toBe(0);
    expect(matchPercentage(1.4)).toBe(100);
    expect(matchPercentage(Number.NaN)).toBe(0);
  });
});

describe('groupMatchCriteria (V2 §7.13)', () => {
  it('leads with what the reader can act on, then met, then optional', () => {
    const groups = groupMatchCriteria([
      criterion('a', 'met'),
      criterion('b', 'optional'),
      criterion('c', 'missing'),
      criterion('d', 'met'),
    ]);

    expect(groups.map((group) => group.state)).toEqual(['missing', 'met', 'optional']);
    expect(groups.map((group) => group.title)).toEqual(['MISSING', 'MET', 'OPTIONAL']);
    // The job's own order survives inside a group.
    expect(groups[1]?.items.map((item) => item.id)).toEqual(['a', 'd']);
  });

  it('omits a group with no rows instead of printing an empty heading', () => {
    const groups = groupMatchCriteria([criterion('a', 'met'), criterion('b', 'met')]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.state).toBe('met');
  });

  it('returns nothing at all for a job that was never matched', () => {
    expect(groupMatchCriteria([])).toEqual([]);
  });
});

describe('criterionA11yLabel', () => {
  it('speaks the state, then the criterion, then its evidence', () => {
    expect(criterionA11yLabel(criterion('a', 'missing'))).toBe('Missing. Criterion a');
    expect(criterionA11yLabel(criterion('b', 'met', 'Required: 5+ years — you have 8'))).toBe(
      'Met. Criterion b. Required: 5+ years — you have 8',
    );
  });
});

describe('MATCH_HONESTY_NOTE (V2 §7.13)', () => {
  it('is the one line on the page that may never be softened', () => {
    expect(MATCH_HONESTY_NOTE).toBe(
      'This is an indicative match against your own profile — not a prediction that you will be ' +
        'shortlisted, and not a judgement by the employer.',
    );
    // All three clauses are load-bearing: whose data, what it does not predict, and who did not
    // make the judgement.
    expect(MATCH_HONESTY_NOTE).toContain('your own profile');
    expect(MATCH_HONESTY_NOTE).toContain('not a prediction');
    expect(MATCH_HONESTY_NOTE).toContain('not a judgement by the employer');
  });
});
