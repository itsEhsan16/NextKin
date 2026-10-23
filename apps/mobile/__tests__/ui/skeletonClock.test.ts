import {
  acquireSkeletonClock,
  releaseSkeletonClock,
  skeletonClock,
  skeletonClockHolders,
} from '@/ui/Skeleton/skeletonClock';

describe('skeletonClock', () => {
  it('is one value every block shares', () => {
    expect(skeletonClock()).toBe(skeletonClock());
  });

  it('runs while any block holds it and rests with the last one gone', () => {
    acquireSkeletonClock();
    acquireSkeletonClock();
    expect(skeletonClockHolders()).toBe(2);
    // Under the mock the loop's first leg lands at once.
    expect(skeletonClock().get()).toBe(1);

    releaseSkeletonClock();
    expect(skeletonClockHolders()).toBe(1);
    expect(skeletonClock().get()).toBe(1);

    releaseSkeletonClock();
    expect(skeletonClockHolders()).toBe(0);
    expect(skeletonClock().get()).toBe(0);
  });

  it('never counts below zero', () => {
    releaseSkeletonClock();
    expect(skeletonClockHolders()).toBe(0);
  });
});
