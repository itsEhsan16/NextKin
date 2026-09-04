import { PixelRatio } from 'react-native';

import { columnWidth, layoutScaleFor, sizes, spacing, tabBarLayoutFor } from '@/theme';

/**
 * Figma artboards are 520 wide; phones are 360–430dp. Everything measured on the artboard —
 * type included — scales by width/520, with no per-value floors: a floor makes one element stop
 * shrinking while its neighbours carry on, which is how text outgrows the box drawn around it.
 */
const IPHONE_14 = 390;
const SMALL_ANDROID = 360;
const NARROWEST_PHONE = 320;
const TABLET = 700;

describe('layoutScaleFor', () => {
  it('is 1:1 at the design width', () => {
    const layout = layoutScaleFor(sizes.designWidth);
    expect(layout.scale).toBe(1);
    expect(layout.s(130)).toBe(130);
  });

  it('scales the whole artboard down proportionally on phones', () => {
    const layout = layoutScaleFor(IPHONE_14);
    expect(layout.scale).toBeCloseTo(390 / 520, 5);
    expect(layout.s(130)).toBeCloseTo(97.5, 1);
    // The gutter is artboard geometry too, so content keeps Figma's 472/520 share of the frame.
    expect(layout.contentWidth).toBeCloseTo(IPHONE_14 - spacing.gutter * (390 / 520) * 2, 5);
    expect(layout.contentWidth / IPHONE_14).toBeCloseTo(472 / 520, 5);
  });

  it('never scales above 1:1 on wide screens', () => {
    expect(layoutScaleFor(TABLET).scale).toBe(1);
  });

  it('stays linear all the way down instead of clamping at a readability floor', () => {
    // 320dp is the narrowest shipping phone (iPhone SE 1st gen); nothing special happens there.
    expect(layoutScaleFor(NARROWEST_PHONE).scale).toBeCloseTo(NARROWEST_PHONE / 520, 5);
    expect(layoutScaleFor(SMALL_ANDROID).scale).toBeCloseTo(SMALL_ANDROID / 520, 5);
  });

  it('bottoms out only on degenerate widths, well below any device', () => {
    // A sanity bound, not a design floor: guards a 0-width first frame from zeroing every token.
    expect(layoutScaleFor(0).scale).toBeGreaterThan(0);
    expect(layoutScaleFor(0).scale).toBeLessThan(NARROWEST_PHONE / 520);
  });

  it('takes no per-call floor: every value shrinks by the same factor', () => {
    const layout = layoutScaleFor(SMALL_ANDROID);
    // The nav glyph used to stop at 18. Holding it there while the pill around it shrank is
    // precisely the mismatch this scale exists to remove.
    expect(layout.s(21)).toBeCloseTo(21 * (SMALL_ANDROID / 520), 5);
    expect(layout.s(21) / layout.s(77)).toBeCloseTo(21 / 77, 5);
  });
});

describe('tabBarLayoutFor', () => {
  const insetBottom = 34; // iPhone home indicator

  it('reproduces the Figma pill at the design width', () => {
    const layout = tabBarLayoutFor(layoutScaleFor(sizes.designWidth), 0);
    // Home Screen 215:490 draws a 299.9475 x 61.633 pill with a 49.99 FAB overhanging 13.7 on a
    // 390 board. These are the 520 equivalents, with NAV_BOOST on top — the bar was still small
    // on a phone at the size that board gives it.
    expect(layout.pillWidth).toBe(440);
    expect(layout.pillHeight).toBeCloseTo(90.396, 3);
    expect(layout.pillRadius).toBeCloseTo(45.198, 3);
    expect(layout.fabSize).toBeCloseTo(73.321, 3);
    expect(layout.fabOverhang).toBeCloseTo(20.088, 3);
  });

  it('keeps the pill at 84.6% of the screen width on a phone', () => {
    const layout = tabBarLayoutFor(layoutScaleFor(IPHONE_14), insetBottom);
    // pillWidth is rounded to whole pixels, so allow sub-pixel drift.
    expect(layout.pillWidth / IPHONE_14).toBeCloseTo((299.9475 * 1.1) / 390, 2);
  });

  it('lifts the bar above the safe-area inset', () => {
    const layout = tabBarLayoutFor(layoutScaleFor(IPHONE_14), insetBottom);
    expect(layout.bottomOffset).toBeGreaterThan(insetBottom);
  });

  it('positions the FAB so it overhangs the top of the pill', () => {
    const layout = tabBarLayoutFor(layoutScaleFor(IPHONE_14), insetBottom);
    const pillTop = layout.bottomOffset + layout.pillHeight;
    const fabTop = layout.fabBottom + layout.fabSize;
    expect(fabTop).toBeCloseTo(pillTop + layout.fabOverhang, 5);
    // The FAB must still overlap the pill rather than float free of it.
    expect(layout.fabBottom).toBeLessThan(pillTop);
  });

  it('reserves enough scroll inset to clear the whole floating chrome', () => {
    const layout = tabBarLayoutFor(layoutScaleFor(IPHONE_14), insetBottom);
    const fabTop = layout.fabBottom + layout.fabSize;
    expect(layout.contentInset).toBeGreaterThanOrEqual(fabTop);
  });
});

/**
 * The rounding trap that collapsed the Resumes grid to a single column.
 *
 * Yoga rounds every node to a whole physical pixel, to the *nearest* one, so a row whose children
 * were computed to sum to exactly their container can come out wider than it and wrap. It depends
 * entirely on the device: at 390 and 430 the numbers land on whole pixels and nothing shows, which
 * is why this shipped. The screenshot that caught it was a 411dp phone at PixelRatio 2.75.
 *
 * These run the real Yoga arithmetic rather than trusting the helper's own rounding.
 */
describe('columnWidth — a row that always fits its container', () => {
  /** Real phones, including the 411 / 2.75 pair that exposed it. */
  const DEVICES: readonly [width: number, ratio: number][] = [
    [320, 2],
    [360, 2],
    [360, 3],
    [390, 3],
    [411, 2.75],
    [412, 2.625],
    [414, 3],
    [430, 3],
  ];

  /** How Yoga lands a length: nearest whole physical pixel. */
  const drawn = (value: number, ratio: number) => Math.round(value * ratio) / ratio;

  const withRatio = (ratio: number, run: () => void) => {
    const get = jest.spyOn(PixelRatio, 'get').mockReturnValue(ratio);
    const round = jest
      .spyOn(PixelRatio, 'roundToNearestPixel')
      .mockImplementation((value: number) => drawn(value, ratio));
    try {
      run();
    } finally {
      get.mockRestore();
      round.mockRestore();
    }
  };

  /** The Resumes grid: two cards and one 16pt gap across the content width. */
  const GRID_GAP = 16;

  it.each(DEVICES)('fits two columns and a gap at %ddp / ratio %s', (width, ratio) => {
    withRatio(ratio, () => {
      const { s, contentWidth } = layoutScaleFor(width);
      const gap = s(GRID_GAP);
      const card = columnWidth(contentWidth, gap);

      const row = drawn(card, ratio) * 2 + drawn(gap, ratio);
      expect(row).toBeLessThanOrEqual(drawn(contentWidth, ratio));
      // Slack is bounded and tiny: at most one physical pixel per floored column, plus one
      // more for the gap rounding down. On the worst pair here that is 1dp across the whole row.
      expect(drawn(contentWidth, ratio) - row).toBeLessThanOrEqual(3 / ratio + 1e-9);
    });
  });

  it('would have caught the exact-sum form that shipped', () => {
    // The previous arithmetic, stated outright so the test says what it defends against.
    withRatio(2.75, () => {
      const { s, contentWidth } = layoutScaleFor(411);
      const gap = s(GRID_GAP);
      const exact = (contentWidth - gap) / 2;

      const overflowing = drawn(exact, 2.75) * 2 + drawn(gap, 2.75);
      expect(overflowing).toBeGreaterThan(drawn(contentWidth, 2.75));
      // A third of a point over is all it takes: flexWrap moves the second card to its own line.
      expect(overflowing - drawn(contentWidth, 2.75)).toBeCloseTo(0.3636, 3);

      expect(columnWidth(contentWidth, gap)).toBeLessThan(exact);
    });
  });

  it('handles three and four across as well as two', () => {
    withRatio(2.75, () => {
      const { s, contentWidth } = layoutScaleFor(411);
      const gap = s(12);
      for (const count of [3, 4, 5]) {
        const cell = columnWidth(contentWidth, gap, count);
        const row = drawn(cell, 2.75) * count + drawn(gap, 2.75) * (count - 1);
        expect(row).toBeLessThanOrEqual(drawn(contentWidth, 2.75));
      }
    });
  });
});
