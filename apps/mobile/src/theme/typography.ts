import type { TextStyle } from 'react-native';

/** Font family names as registered by @expo-google-fonts/plus-jakarta-sans. */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export type FontWeightKey = keyof typeof fontFamily;

export type TypeRole = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;

const role = (
  family: FontWeightKey,
  fontSize: number,
  lineHeight: number,
  letterSpacing = 0,
): TypeRole => ({
  fontFamily: fontFamily[family],
  fontSize,
  lineHeight,
  letterSpacing,
});

/**
 * Text roles mapped from Figma text styles (Plus Jakarta Sans).
 * Use `<Text role="title">` rather than ad-hoc font sizes.
 */
export const typography = {
  displayLg: role('bold', 28, 36, -0.4), // hero numbers / greeting name
  display: role('bold', 22, 30, -0.3), // screen titles, stat values
  headline: role('bold', 20, 28, -0.2), // sheet / section titles
  title: role('semiBold', 17, 24), // card titles, row labels
  titleSm: role('semiBold', 15, 22), // salary, secondary titles
  body: role('regular', 15, 22),
  bodyMedium: role('medium', 15, 22),
  bodySemiBold: role('semiBold', 15, 22),
  caption: role('medium', 13, 20), // meta, subtitles
  captionRegular: role('regular', 13, 20),
  captionSemiBold: role('semiBold', 13, 20), // selected segment, match pill
  micro: role('medium', 11, 14),
  microSemiBold: role('semiBold', 12, 16),
  badge: role('bold', 10, 14, 0.2), // "AI" badge
  tabLabel: role('semiBold', 9, 13, 0.1),
  statLg: role('bold', 22, 28, -0.3),
  stat: role('bold', 18, 24, -0.2),
  logoInitial: role('bold', 18, 22),
} as const satisfies Record<string, TypeRole>;

export type TypographyRole = keyof typeof typography;
