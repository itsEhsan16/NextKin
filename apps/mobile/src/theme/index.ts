import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useAppearanceStore } from './appearance';
import { motion } from './motion';
import {
  colorsByScheme,
  opacity,
  radii,
  shadows,
  sizes,
  spacing,
  zIndex,
  type ColorScheme,
  type Colors,
} from './tokens';
import { fontFamily, typography } from './typography';

export * from './tokens';
export * from './typography';
export * from './motion';
export { useAppearanceStore, type AppearancePreference } from './appearance';

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  spacing: typeof spacing;
  radii: typeof radii;
  sizes: typeof sizes;
  shadows: typeof shadows;
  opacity: typeof opacity;
  zIndex: typeof zIndex;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
  motion: typeof motion;
};

const buildTheme = (scheme: ColorScheme): Theme => ({
  scheme,
  colors: colorsByScheme[scheme],
  spacing,
  radii,
  sizes,
  shadows,
  opacity,
  zIndex,
  typography,
  fontFamily,
  motion,
});

const themes: Record<ColorScheme, Theme> = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
};

/** Resolves the effective colour scheme from the OS scheme + the user's appearance preference. */
export function useResolvedScheme(): ColorScheme {
  const systemScheme = useColorScheme();
  const preference = useAppearanceStore((s) => s.preference);
  if (preference === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return preference;
}

/** The single entry point for design tokens inside components. Stable object identity per scheme. */
export function useTheme(): Theme {
  const scheme = useResolvedScheme();
  return useMemo(() => themes[scheme], [scheme]);
}

export const lightTheme = themes.light;
export const darkTheme = themes.dark;
