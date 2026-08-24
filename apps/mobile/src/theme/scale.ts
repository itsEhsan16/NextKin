import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sizes, spacing } from './tokens';

/**
 * The Figma artboards are 520px wide — wider than any phone (360–430dp). Everything measured on
 * them, *type included*, is projected onto the device by a single factor so each screen is a
 * true proportional replica of its frame: what fits in Figma fits here, at the same relative
 * size and position.
 *
 * There are no per-value floors. A floor makes one element stop shrinking while its neighbours
 * carry on, which is exactly how text ends up too large for the box drawn around it.
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

export function useLayoutScale(): LayoutScale {
  const { width } = useWindowDimensions();
  return useMemo(() => layoutScaleFor(width), [width]);
}

/**
 * Floating tab bar geometry from the Home artboard: a 372.675 × 76.577 pill (71.7% of the
 * 520 frame), radius 42.5, lifted 17.42px off the bottom, with a 60px FAB whose top pokes
 * 17px above the pill. Shared by FloatingTabBar, Fab and Screen so the inset math agrees.
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

const PILL_WIDTH_RATIO = 372.675 / 520;

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
