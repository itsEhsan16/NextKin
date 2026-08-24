import { StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

import { useAppearanceStore } from './appearance';
import { motion } from './motion';
import { layoutScaleFor } from './scale';
import {
  scaleRadii,
  scaleShadows,
  scaleSizes,
  scaleSpacing,
  scaleTypography,
  type Radii,
  type Shadows,
  type Sizes,
  type Spacing,
  type Typography,
} from './scaleTheme';
import {
  colorsByScheme,
  opacity,
  sizes,
  zIndex,
  type ColorScheme,
  type Colors,
} from './tokens';
import { fontFamily } from './typography';

export * from './tokens';
export * from './typography';
export * from './motion';
export * from './scale';
export * from './scaleTheme';
export { useAppearanceStore, type AppearancePreference } from './appearance';

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  spacing: Spacing;
  radii: Radii;
  sizes: Sizes;
  shadows: Shadows;
  opacity: typeof opacity;
  zIndex: typeof zIndex;
  typography: Typography;
  fontFamily: typeof fontFamily;
  motion: typeof motion;
  /** Artboard→device factor these tokens were built at. 1 at the 520px design width. */
  scale: number;
  /** Scales a raw Figma px value. Never pass it a value taken off this theme. */
  s: (px: number) => number;
  /** The width the design lays out in: the screen width, capped at the 520px artboard. */
  width: number;
  /** Width available to content inside the (scaled) horizontal gutters. */
  contentWidth: number;
};

/**
 * One theme per (scheme, frame width). Device widths are a small finite set, so this stays tiny
 * — and because the map *is* the memo, identity is stable across components, not merely across
 * a component's re-renders.
 */
const cache = new Map<string, Theme>();
const MAX_CACHE_ENTRIES = 32;

function buildTheme(scheme: ColorScheme, frameWidth: number): Theme {
  const layout = layoutScaleFor(frameWidth);
  const { scale } = layout;

  return {
    scheme,
    colors: colorsByScheme[scheme],
    spacing: scaleSpacing(scale),
    radii: scaleRadii(scale),
    sizes: scaleSizes(scale),
    shadows: scaleShadows(scale),
    opacity,
    zIndex,
    typography: scaleTypography(scale),
    fontFamily,
    motion,
    scale,
    s: layout.s,
    width: layout.width,
    contentWidth: layout.contentWidth,
  };
}

/**
 * The scaled token set for a scheme at a given screen width. Widths are quantised to whole dp
 * and capped at the artboard width, so a 520px design frame and any wider screen share one
 * entry — which is what keeps `themeFor('light', 750) === lightTheme` true under Jest.
 */
export function themeFor(scheme: ColorScheme, width: number): Theme {
  const frameWidth = Math.min(Math.round(width) || sizes.designWidth, sizes.designWidth);
  const key = `${scheme}:${frameWidth}`;

  const cached = cache.get(key);
  if (cached) return cached;

  // A surface being dragged (Android split-screen) would otherwise grow this without bound.
  if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();

  const theme = buildTheme(scheme, frameWidth);
  cache.set(key, theme);
  return theme;
}

/** Resolves the effective colour scheme from the OS scheme + the user's appearance preference. */
export function useResolvedScheme(): ColorScheme {
  const systemScheme = useColorScheme();
  const preference = useAppearanceStore((s) => s.preference);
  if (preference === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return preference;
}

/**
 * The single entry point for design tokens inside components. Every length it returns is already
 * projected onto this device, so components never scale anything themselves.
 */
export function useTheme(): Theme {
  const scheme = useResolvedScheme();
  const { width } = useWindowDimensions();
  return themeFor(scheme, width);
}

/** The unscaled, 1:1 artboard themes. Handy in tests; components must use `useTheme()`. */
export const lightTheme = themeFor('light', sizes.designWidth);
export const darkTheme = themeFor('dark', sizes.designWidth);

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * `StyleSheet.create` for artboard geometry.
 *
 * A plain `StyleSheet.create` runs at module scope, where the device width is unknown, so any
 * length in it renders at its raw 520px artboard value. This takes a factory instead and hands
 * it `s()`, so the sheet is built per scale and cached — one sheet per device width, with stable
 * identity, exactly like the static version.
 *
 *   const useStyles = scaledSheet((s) => ({ chip: { paddingHorizontal: s(14) } }));
 *   // inside the component:
 *   const styles = useStyles();
 *
 * Structural values (flex, alignItems, '100%', hairlineWidth) need no `s()` — only lengths that
 * were measured on the artboard.
 */
export function scaledSheet<T extends NamedStyles<T>>(
  factory: (s: (px: number) => number) => T & NamedStyles<T>,
): () => T {
  const cache = new Map<number, T>();

  return function useScaledStyles(): T {
    const { scale, s } = useTheme();
    const cached = cache.get(scale);
    if (cached) return cached;

    const created = StyleSheet.create(factory(s));
    cache.set(scale, created);
    return created;
  };
}
