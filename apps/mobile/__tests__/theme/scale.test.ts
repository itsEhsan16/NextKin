import { layoutScaleFor, sizes, spacing, tabBarLayoutFor } from '@/theme';

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
    // Figma: 372.675 x 76.577 pill, radius 42.5, 60px FAB overhanging 17px.
    expect(layout.pillWidth).toBe(373);
    expect(layout.pillHeight).toBe(77);
    expect(layout.pillRadius).toBeCloseTo(38.5, 1);
    expect(layout.fabSize).toBe(60);
    expect(layout.fabOverhang).toBe(17);
  });

  it('keeps the pill at 71.7% of the screen width on a phone', () => {
    const layout = tabBarLayoutFor(layoutScaleFor(IPHONE_14), insetBottom);
    // pillWidth is rounded to whole pixels, so allow sub-pixel drift.
    expect(layout.pillWidth / IPHONE_14).toBeCloseTo(372.675 / 520, 2);
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
