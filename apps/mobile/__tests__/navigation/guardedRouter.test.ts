import { allowNavigation, navigationGate, resetNavigationGuard } from '@/navigation/guardedRouter';
import { motion } from '@/theme';

describe('allowNavigation (§196, the double-tap guard)', () => {
  beforeEach(() => {
    navigationGate.windowMs = motion.durations.navGuard;
    resetNavigationGuard();
  });

  it('lets the first move through and drops a repeat inside the window', () => {
    expect(allowNavigation(1000)).toBe(true);
    expect(allowNavigation(1000 + motion.durations.navGuard - 1)).toBe(false);
  });

  it('lets the next move through once the window has passed', () => {
    expect(allowNavigation(1000)).toBe(true);
    expect(allowNavigation(1000 + motion.durations.navGuard)).toBe(true);
  });

  it('measures the window from the last move that went through, not the dropped one', () => {
    expect(allowNavigation(0)).toBe(true);
    expect(allowNavigation(300)).toBe(false);
    expect(allowNavigation(motion.durations.navGuard)).toBe(true);
  });
});
