import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NAV_BOOST, sizes, spacing } from './tokens';

/**
 * The Figma artboards are 520px wide — wider than any phone (360–430dp). Every *length* measured
 * on them is projected onto the device by a single factor, so each screen is a true proportional
 * replica of its frame: what fits in Figma fits here, at the same relative size and position.
 *
 * There are no per-value floors here, and there must not be: a floor makes one box stop shrinking
 * while its neighbours carry on, which is exactly how text ends up too large for the box drawn
 * around it. The Figma "Mobile 2" page is the proof that this half is right — redrawn at 390, it
 * is this page at exactly 0.75, node for node, which is what this function already computes.
 *
 * Type is the one thing that does *not* follow this factor, because the design team drew it that
 * way: on the 390 board the font sizes were deliberately held back so text stays legible in boxes
 * that shrank, while leading kept scaling so the glyphs grow into their line boxes instead of
 * pushing the layout apart. That lives in `typographyFor()` — see src/theme/scaleTheme.ts.
 *
 * `s(n)` scales a raw design px value. Anything already read off `useTheme()` is scaled —
 * passing a token through `s()` squares the factor. `contentWidth` is the width inside the
 * (scaled) gutters.
 */
export type LayoutScale = {
  /** Scale factor in [MIN_SCALE, 1]. 1 on a 520px wide screen. */
  scale: number;
  /** Scale a raw Figma px value. Never pass it a value that came from the theme. */
  s: (px: number) => number;
  /** Screen width in dp. */
  width: number;
  /** Width available to content inside the horizontal gutters. */
  contentWidth: number;
};

/** Sanity bound only — no shipping phone comes close. Guards against a 0-width first frame. */
const MIN_SCALE = 0.4;

/** Beyond the artboard width the design stops growing and centres; see `Screen`. */
const frameWidth = (width: number) => Math.min(width, sizes.designWidth);

export function layoutScaleFor(width: number): LayoutScale {
  const scale = Math.min(1, Math.max(MIN_SCALE, width / sizes.designWidth));
  const s = (px: number) => px * scale;
  return {
    scale,
    s,
    width,
    contentWidth: frameWidth(width) - s(spacing.gutter) * 2,
  };
}

/**
 * The width of one column when `count` of them share `available` with `gap` between each.
 *
 * The obvious form — `(available - gap * (count - 1)) / count` — is a trap, and it shipped. It
 * makes the row sum to *exactly* the container, which is fine in float and fatal after layout:
 * Yoga rounds every node to a whole physical pixel, to the NEAREST one, so each child can gain up
 * to half a pixel and the row can end up wider than the box it was measured against.
 *
 * That is what broke the Resumes grid on a 411dp screen (scale 0.790384, PixelRatio 2.75): two
 * 180.208 cards rounded up to 180.364 each and the 12.646 gap to 12.727, needing 373.455 of a
 * 373.091 row. `flexWrap` moved the second card onto its own line, so a two-column grid rendered
 * as one column with a dead half-screen beside it. It is invisible at 390 and 430, where the
 * numbers happen to land on whole pixels — which is exactly why it survived review and tests.
 *
 * So: subtract the gap Yoga will actually draw, then floor each column to a whole pixel. The row
 * then sums to strictly less than the container at every scale, for under a pixel of slack at the
 * right edge.
 *
 * Reach for this only where a real number is needed — a grid cell that also feeds an aspect ratio
 * or a skeleton, as the resumes grid does. Where the layout allows `flex: 1` or a percentage,
 * prefer those: Yoga distributes the remainder itself and this cannot arise.
 */
export function columnWidth(available: number, gap: number, count = 2): number {
  const drawnGap = PixelRatio.roundToNearestPixel(gap);
  const raw = (available - drawnGap * (count - 1)) / count;
  const ratio = PixelRatio.get();
  return Math.floor(raw * ratio) / ratio;
}

export function useLayoutScale(): LayoutScale {
  const { width } = useWindowDimensions();
  return useMemo(() => layoutScaleFor(width), [width]);
}

/**
 * Floating tab bar geometry from Home Screen 215:490: a 299.9475 × 61.633 pill (76.9% of the
 * 390 frame) with a 49.99 FAB whose top pokes 13.7 above it — all quoted here in 390 space, and
 * held in `sizes` as the 520 equivalents. Shared by FloatingTabBar, Fab and Screen so the inset
 * math agrees.
 *
 * Reads the raw `sizes` and applies `s()` itself, so it must never be fed the scaled theme.
 */
export type TabBarLayout = {
  pillWidth: number;
  pillHeight: number;
  pillRadius: number;
  /** Distance from the screen bottom to the pill's bottom edge (includes the safe-area inset). */
  bottomOffset: number;
  fabSize: number;
  /** How far the FAB extends above the pill's top edge. */
  fabOverhang: number;
  /** Distance from the screen bottom to the FAB's bottom edge. */
  fabBottom: number;
  iconSize: number;
  /** Total vertical space scrolling content must reserve. */
  contentInset: number;
};

/**
 * Pill width as a share of the frame, from Home Screen 215:490: 299.9475 on a 390 board.
 *
 * The older boards draw the same component at 372.675/520 = 71.7%. This one places it at 80.5%
 * of its 520 size on a 390 frame, which works out 7.3% wider relative to the screen — the nav
 * grew, the frame did not.
 */
const PILL_WIDTH_RATIO = (299.9475 * NAV_BOOST) / 390;

export function tabBarLayoutFor(layout: LayoutScale, insetBottom: number): TabBarLayout {
  const { s, width } = layout;
  const pillHeight = s(sizes.tabBarHeight);
  // The safe-area inset is physical device space — it is added, never scaled.
  const bottomOffset = s(sizes.tabBarBottomOffset) + insetBottom;
  const fabSize = s(sizes.fab);
  const fabOverhang = s(sizes.fabOverhang);
  return {
    pillWidth: Math.round(frameWidth(width) * PILL_WIDTH_RATIO),
    pillHeight,
    pillRadius: pillHeight / 2,
    bottomOffset,
    fabSize,
    fabOverhang,
    fabBottom: bottomOffset + pillHeight + fabOverhang - fabSize,
    iconSize: s(21),
    contentInset: bottomOffset + pillHeight + fabOverhang + s(spacing[2]),
  };
}

export function useTabBarLayout(): TabBarLayout {
  const layout = useLayoutScale();
  const insets = useSafeAreaInsets();
  return useMemo(() => tabBarLayoutFor(layout, insets.bottom), [insets.bottom, layout]);
}
