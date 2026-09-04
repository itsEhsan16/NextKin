import { formatLakh, withReducedMotion } from '@/lib';

/**
 * The crash that took the job detail screen down on mount.
 *
 * `JobAboutSection` rotated its chevron from a `useDerivedValue`, and that mapper called
 * `withReducedMotion` on the UI runtime. The Worklets plugin rewrites a plain function captured
 * by a worklet as a *remote* function — reachable only through `runOnJS` — so calling it
 * synchronously threw "[Worklets] Tried to synchronously call a Remote Function. Called
 * 'withReducedMotion' on the UI Runtime." and redboxed the screen.
 *
 * No render test can reach that. `jest.setup.ts` swaps in `react-native-reanimated/mock`, which
 * runs every worklet as ordinary JS on a single runtime, so `JobDetailScreen.test.tsx` presses
 * both "Show more" and "Show less" and sees nothing wrong — the prop docs on `AnimatedNumber` and
 * `RangeValueLabel` already say as much. What Jest *can* see is the babel plugin's output, so
 * that is what this asserts: the metadata the plugin attaches when a body opens with 'worklet'.
 */
describe('lib helpers a worklet is allowed to call', () => {
  /**
   * Every `@/lib` export reached from the UI runtime today. Add to this list when a worklet
   * starts calling a new one — the directive is invisible at the call site, and its absence is a
   * runtime crash rather than a type error.
   */
  const WORKLET_HELPERS: Record<string, unknown> = { formatLakh, withReducedMotion };

  it.each(Object.keys(WORKLET_HELPERS))('%s is workletised by the babel plugin', (name) => {
    const fn = WORKLET_HELPERS[name] as Record<string, unknown>;
    const initData = fn.__initData as { code?: string } | undefined;

    expect(fn.__workletHash).toBeDefined();
    // Not just "some marker exists": the captured source has to be *this* function's body, which
    // is what fails if the directive is deleted from it and left on a neighbour.
    expect(initData?.code).toEqual(expect.stringContaining(name));
  });
});

describe('withReducedMotion', () => {
  it('hands back the very same config when motion is allowed', () => {
    // Identity, not equality: Sheet, SwipeableRow and RangeSlider memoise on this result and hand
    // the object to a worklet. A fresh object each call would rebuild their gestures every render.
    const timing = { duration: 260 };
    expect(withReducedMotion(false, timing)).toBe(timing);
  });

  it('collapses to a single frame when Reduce Motion is on', () => {
    expect(withReducedMotion(true, { duration: 260 })).toEqual({ duration: 1 });
  });

  it('never mutates the config it was handed', () => {
    const spring = { damping: 18, stiffness: 220 };
    withReducedMotion(true, spring);
    expect(spring).toEqual({ damping: 18, stiffness: 220 });
  });
});
