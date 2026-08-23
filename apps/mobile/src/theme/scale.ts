import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sizes, spacing } from './tokens';

/**
 * The Figma artboards are 520 px wide — wider than any phone (360–430 dp). Text roles stay at
 * their designed sizes for readability; *fixed geometry* that was sized for that frame (hero
 * type, tiles, card widths, chrome) shrinks proportionally so proportions match the design.
 *
 * `s(n)` scales a design px value; `contentWidth` is the width inside the 24 pt gutters.
 */
export type LayoutScale = {
  /** Scale factor in [MIN_SCALE, 1]. 1 on a 520 px wide screen. */
  scale: number;
  /** Scale a Figma px value. Optional `min` keeps tap targets / glyphs from shrinking too far. */
  s: (px: number, min?: number) => number;
  /** Screen width in dp. */
  width: number;
  /** Width available to content inside the horizontal gutters. */
  contentWidth: number;
};

const MIN_SCALE = 0.7;

export function layoutScaleFor(width: number): LayoutScale {
  const scale = Math.min(1, Math.max(MIN_SCALE, width / sizes.designWidth));
  return {
    scale,
    s: (px, min) => {
      const scaled = px * scale;
      return min == null ? scaled : Math.max(min, scaled);
    },
    width,
    contentWidth: width - spacing.gutter * 2,
  };
}

export function useLayoutScale(): LayoutScale {
  const { width } = useWindowDimensions();
  return useMemo(() => layoutScaleFor(width), [width]);
}

/**
 * Floating tab bar geometry from the Home artboard: a 372.675 × 76.577 pill (71.7% of the
 * 520 frame), radius 42.5, lifted 17.42 px off the bottom, with a 60 px FAB whose top pokes
 * 17 px above the pill. Shared by FloatingTabBar, Fab and Screen so the inset math agrees.
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

const PILL_WIDTH_RATIO = 372.675 / 520;

export function tabBarLayoutFor(layout: LayoutScale, insetBottom: number): TabBarLayout {
  const { s, width } = layout;
  const pillHeight = s(sizes.tabBarHeight, 60);
  const bottomOffset = s(sizes.tabBarBottomOffset, 10) + insetBottom;
  const fabSize = s(sizes.fab, 50);
  const fabOverhang = s(sizes.fabOverhang, 12);
  return {
    pillWidth: Math.round(width * PILL_WIDTH_RATIO),
    pillHeight,
    pillRadius: pillHeight / 2,
    bottomOffset,
    fabSize,
    fabOverhang,
    fabBottom: bottomOffset + pillHeight + fabOverhang - fabSize,
    iconSize: s(21, 18),
    contentInset: bottomOffset + pillHeight + fabOverhang + spacing[2],
  };
}

export function useTabBarLayout(): TabBarLayout {
  const layout = useLayoutScale();
  const insets = useSafeAreaInsets();
  return useMemo(() => tabBarLayoutFor(layout, insets.bottom), [insets.bottom, layout]);
}
