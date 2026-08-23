import { Platform } from 'react-native';

import { palette } from './palette';

export type ColorScheme = 'light' | 'dark';

/** Semantic colour roles. Keys are stable across schemes; only values change. */
export const colorsByScheme = {
  light: {
    // Text
    textPrimary: palette.ink900,
    textBody: palette.ink700,
    textSecondary: palette.ink500,
    textTertiary: palette.ink450,
    textBlack: palette.black,
    textOnDark: palette.offWhite,
    textOnBrand: palette.white,

    // Surfaces
    surfacePage: palette.white,
    surfaceCard: palette.white,
    surfaceSubtle: palette.gray150,
    surfaceSheet: palette.white,
    surfaceInverse: palette.ink900,
    surfaceBlack: palette.black,

    // Borders
    borderDefault: palette.gray200,
    borderHairline: palette.gray100,
    divider: palette.gray100,
    grabHandle: palette.gray200,

    // Icons
    iconDefault: palette.ink500,
    iconMuted: palette.ink450,
    iconChevron: palette.ink300,

    // Brand
    brand: palette.brand500,
    brandSurface: palette.brand50,
    brandBorder: palette.brand200,
    /** Inline text links ("View all"). */
    link: palette.blue600,

    // Status
    success: palette.green600,
    successSurface: palette.green50,
    successRing: palette.green400,
    successIcon: palette.green500,
    progressTrack: palette.gray200,
    progressFill: palette.blue500,
    danger: palette.red600,
    dangerDot: palette.red500,
    dangerSurface: palette.red50,
    warning: palette.amber600,
    warningSurface: palette.amber50,

    // Chrome
    tabBarBackground: palette.white,
    tabActive: palette.ink900,
    tabInactive: palette.slate600,
    tabLabel: palette.ink900,
    avatarStack1: palette.gray300,
    avatarStack2: palette.ink400,
    avatarStack3: palette.ink500,
    fabFill: palette.black,
    fabGlyph: palette.offWhite,
    scrim: 'rgba(10, 10, 10, 0.5)',
    skeletonBase: palette.gray150,
    skeletonHighlight: palette.gray50,
  },
  dark: {
    textPrimary: '#F5F6F8',
    textBody: '#C9CDD6',
    textSecondary: '#9AA1AE',
    textTertiary: '#6B7280',
    textBlack: '#FFFFFF',
    textOnDark: palette.offWhite,
    textOnBrand: palette.white,

    surfacePage: palette.dark900,
    surfaceCard: palette.dark800,
    surfaceSubtle: palette.dark700,
    surfaceSheet: palette.dark800,
    surfaceInverse: palette.white,
    surfaceBlack: palette.white,

    borderDefault: palette.dark600,
    borderHairline: palette.dark700,
    divider: palette.dark700,
    grabHandle: palette.dark500,

    iconDefault: '#9AA1AE',
    iconMuted: '#6B7280',
    iconChevron: '#4B5563',

    brand: '#7C6CFF',
    brandSurface: '#1E1B3A',
    brandBorder: '#2F2A5C',
    link: '#60A5FA',

    success: '#4ADE80',
    successSurface: '#0F2A1A',
    successRing: '#4ADE80',
    successIcon: '#4ADE80',
    progressTrack: palette.dark600,
    progressFill: '#60A5FA',
    danger: '#F87171',
    dangerDot: palette.red500,
    dangerSurface: '#2A1414',
    warning: '#FBBF24',
    warningSurface: '#2A2110',

    tabBarBackground: palette.dark800,
    tabActive: '#F5F6F8',
    tabInactive: '#8B90A5',
    tabLabel: '#F5F6F8',
    avatarStack1: palette.dark500,
    avatarStack2: '#6B7280',
    avatarStack3: '#9AA1AE',
    fabFill: palette.white,
    fabGlyph: palette.black,
    scrim: 'rgba(0, 0, 0, 0.6)',
    skeletonBase: palette.dark700,
    skeletonHighlight: palette.dark600,
  },
} as const satisfies Record<ColorScheme, Record<string, string>>;

export type Colors = { [K in keyof (typeof colorsByScheme)['light']]: string };
export type ColorToken = keyof Colors;

/** 4-pt spacing scale. Screen gutter is `spacing.gutter` (24). */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  gutter: 24,
} as const;

export const radii = {
  none: 0,
  xs: 8, // resume thumbnail
  sm: 9, // meta chip
  md: 12, // 40px logo tile, segmented active pill
  lg: 14, // 44/48px logo tile
  xl: 16, // inputs, buttons, 52px icon tiles
  xxl: 18, // 64px logo tile
  card: 20,
  cardLg: 24,
  sheet: 28,
  emptyTile: 28,
  full: 9999,
} as const;

export const sizes = {
  tabBarHeight: 77,
  tabBarBottomOffset: 17,
  fab: 60,
  fabOverhang: 17,
  iconButton: 48,
  filterButton: 52,
  buttonMd: 52,
  buttonLg: 56,
  listRow: 58,
  grabHandleWidth: 44,
  grabHandleHeight: 5,
  minHitTarget: 44,
  avatarHeader: 56,
  completenessRing: 104,
  emptyStateTile: 96,
  sheetStep1Height: 600,
  sheetStep2Height: 520,
  /** Header chrome from the Home screen. */
  headerButton: 48,
  unreadDot: 8,
  /** Width of the artboards in the Figma file; see useLayoutScale(). */
  designWidth: 520,
} as const;

type ShadowStyle = {
  boxShadow?: string;
  elevation?: number;
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
};

const shadow = (
  x: number,
  y: number,
  blur: number,
  alpha: number,
  elevation: number,
): ShadowStyle =>
  // RN 0.76+ renders boxShadow natively on Android too, where `elevation` independently paints
  // its own shadow — emitting both stacks two shadows. Elevation still owns Android's sibling
  // z-ordering, so keep elevation there and boxShadow (which honours the Figma offsets) on iOS.
  Platform.OS === 'android'
    ? { elevation }
    : { boxShadow: `${x}px ${y}px ${blur}px rgba(0, 0, 0, ${alpha})` };

export const shadows = {
  none: {} as ShadowStyle,
  tabBar: shadow(0, -3.4, 8.5, 0.12, 8),
  fab: shadow(0, 6, 12, 0.18, 10),
  stickyBarUp: shadow(0, -2, 7, 0.07, 6),
  card: shadow(0, 1, 2, 0.05, 1),
  sheet: shadow(0, -4, 32, 0.18, 12),
} as const;

export const opacity = {
  disabled: 0.4,
  pressed: 0.85,
  scrim: 0.5,
} as const;

export const zIndex = {
  content: 0,
  stickyBar: 10,
  tabBar: 20,
  fab: 30,
  scrim: 40,
  sheet: 50,
  toast: 60,
} as const;
