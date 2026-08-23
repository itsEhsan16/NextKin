import { layoutScaleFor, sizes } from '@/theme';
import { resolveSheetHeight } from '@/ui/Sheet';

/**
 * The create sheet is the case that forced this rule. Its artboard is 600pt tall on a 520pt-wide
 * frame, but the row stack inside it is laid out in unscaled points, so on a narrower phone the
 * descriptions wrap and the content grows past the scaled sheet height. The sheet clips
 * (overflow: 'hidden'), so a fixed height would cut the last row off — and a clipped row is
 * untappable on Android.
 */
const IPHONE_14 = 390;
const IPHONE_SE = 375;
const SMALL_ANDROID = 360;

const INSET_BOTTOM = 34;
const INSET_TOP = 47;
const WINDOW_HEIGHT = 844;

const base = {
  insetBottom: INSET_BOTTOM,
  insetTop: INSET_TOP,
  windowHeight: WINDOW_HEIGHT,
};

/** Scaled CREATE 01 height, as CreateSheetHost computes it. */
const designHeightAt = (width: number) =>
  layoutScaleFor(width).s(sizes.sheetStep1Height, 420);

describe('resolveSheetHeight', () => {
  it('uses the design height when the content fits inside it', () => {
    const designHeight = designHeightAt(IPHONE_14);
    expect(resolveSheetHeight({ ...base, designHeight, contentHeight: 300 })).toBe(
      designHeight + INSET_BOTTOM,
    );
  });

  it('grows past the design height rather than clipping taller content', () => {
    // Two wrapped rows on a 375pt screen push the CREATE 01 stack to ~452pt.
    const designHeight = designHeightAt(IPHONE_SE);
    const contentHeight = 452;
    expect(contentHeight).toBeGreaterThan(designHeight);
    expect(resolveSheetHeight({ ...base, designHeight, contentHeight })).toBe(
      contentHeight + INSET_BOTTOM,
    );
  });

  it('grows on the smallest supported width, where the design height hits its floor', () => {
    // At 360pt the scaled height clamps to the 420 floor while three rows wrap to ~466pt.
    const designHeight = designHeightAt(SMALL_ANDROID);
    expect(designHeight).toBe(420);
    expect(resolveSheetHeight({ ...base, designHeight, contentHeight: 466 })).toBe(
      466 + INSET_BOTTOM,
    );
  });

  it('never exceeds the screen below the top inset', () => {
    const height = resolveSheetHeight({ ...base, designHeight: 600, contentHeight: 2000 });
    expect(height).toBe(WINDOW_HEIGHT - INSET_TOP);
    expect(height).toBeLessThan(WINDOW_HEIGHT);
  });

  it('ignores the unmeasured content height on the first pass', () => {
    const designHeight = designHeightAt(IPHONE_14);
    expect(resolveSheetHeight({ ...base, designHeight, contentHeight: 0 })).toBe(
      designHeight + INSET_BOTTOM,
    );
  });
});
