import type { TextStyle } from 'react-native';

/** Font family names as registered by @expo-google-fonts/plus-jakarta-sans. */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  /** Brand wordmark only (Figma uses Inter Bold for the "NextKin" logotype). */
  brand: 'Inter_700Bold',
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
 * Use `<Text variant="title">` rather than ad-hoc font sizes.
 */
export const typography = {
  /** Home hero ("Build better. Land faster.") — scale with useLayoutScale(). */
  hero: role('bold', 46, 53),
  /** "NextKin" logotype — scale with useLayoutScale(). */
  wordmark: role('brand', 43, 43),
  displayLg: role('bold', 28, 36, -0.4), // hero numbers / greeting name
  display: role('bold', 22, 30, -0.3), // screen titles, stat values
  headline: role('bold', 20, 28, -0.2), // sheet / section titles
  greetingLabel: role('regular', 15, 19), // header "Hi" line (Figma 15/18.75)
  greeting: role('medium', 20, 25), // header user name
  section: role('semiBold', 19, 28), // card section titles ("Quick Start")
  sectionBold: role('bold', 19, 28), // "Your Resume Progress"
  sectionRegular: role('regular', 19, 28), // "Top Job Matches"
  cardTitle: role('semiBold', 18, 27), // company name on job cards
  label: role('semiBold', 16, 24), // resume title in progress card
  title: role('semiBold', 17, 24), // card titles, row labels
  titleSm: role('semiBold', 15, 22), // salary, secondary titles
  body: role('regular', 15, 22),
  bodyMedium: role('medium', 15, 22),
  bodySemiBold: role('semiBold', 15, 22),
  caption: role('medium', 13, 20), // meta, subtitles
  captionRegular: role('regular', 13, 20),
  captionSemiBold: role('semiBold', 13, 20), // selected segment, match pill
  micro: role('medium', 11, 16.5),
  microRegular: role('regular', 11, 16),
  microSemiBold: role('semiBold', 12, 18),
  tiny: role('regular', 10, 15), // shortcut sub-labels, ring caption
  badge: role('bold', 10, 14, 0.2), // "AI" badge
  tabLabel: role('semiBold', 9, 13, 0.1),
  statLg: role('bold', 22, 28, -0.3),
  statRegular: role('regular', 20, 30), // ATS ring value
  stat: role('bold', 18, 24, -0.2),
  logoInitial: role('bold', 18, 22),
} as const satisfies Record<string, TypeRole>;

export type TypographyRole = keyof typeof typography;
