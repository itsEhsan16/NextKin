import { layoutScaleFor, sizes, spacing, tabBarLayoutFor } from '@/theme';

/** Figma artboards are 520 wide; phones are 360–430dp. */
const IPHONE_14 = 390;
const SMALL_ANDROID = 360;
const TABLET = 700;

describe('layoutScaleFor', () => {
  it('is 1:1 at the design width', () => {
    const layout = layoutScaleFor(sizes.designWidth);
    expect(layout.scale).toBe(1);
    expect(layout.s(130)).toBe(130);
  });

  it('scales fixed geometry down proportionally on phones', () => {
    const layout = layoutScaleFor(IPHONE_14);
    expect(layout.scale).toBeCloseTo(390 / 520, 5);
    expect(layout.s(130)).toBeCloseTo(97.5, 1);
    expect(layout.contentWidth).toBe(IPHONE_14 - spacing.gutter * 2);
  });

  it('never scales above 1:1 on wide screens', () => {
    expect(layoutScaleFor(TABLET).scale).toBe(1);
  });

  it('clamps at the floor so tap targets stay usable on tiny screens', () => {
    expect(layoutScaleFor(200).scale).toBe(0.7);
  });

  it('honours the per-call minimum', () => {
    const layout = layoutScaleFor(SMALL_ANDROID);
    // 21 * (360/520) ≈ 14.5, but nav glyphs must not drop below 18.
    expect(layout.s(21)).toBeLessThan(18);
    expect(layout.s(21, 18)).toBe(18);
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
