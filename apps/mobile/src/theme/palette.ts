/**
 * Raw palette — extracted from the NextKin Figma file (page "Mobile App").
 * Never import this from screens: use semantic `colors` from `@/theme` instead.
 */
export const palette = {
  white: '#FFFFFF',
  offWhite: '#FBFBFD',
  black: '#0A0A0A',

  ink900: '#111827',
  ink700: '#4B5563',
  ink500: '#6B7280',
  ink400: '#9CA3AF',
  /** Darkened from Figma's #9CA3AF: that value is 2.54:1 on white, below WCAG AA. */
  ink450: '#767E8B',
  // Text shades, each ink darkened in HSL (hue kept) only as far as AA (4.5:1) needs on the
  // surfaces it is set on — toreview.md 54.
  /** Secondary text: #6B7280 is 4.32:1 on the grey chip and search fill (gray150). */
  ink520: '#686F7D',
  /** Tertiary text: #767E8B is 4.10:1 on white and 3.82:1 on the unread-row wash. */
  ink480: '#6B727E',
  ink300: '#C4C4C6',

  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray150: '#F1F2F4',
  /** A read notification card's border (Figma 619:89). */
  gray120: '#EEF0F3',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',

  slate600: '#545974',

  blue600: '#2563EB',
  blue500: '#3B82F6',
  /** Info glyph tile (Figma 619:98). */
  blue50: '#E8F0FF',

  /** The warm "closing soon" tile and its glyph (Figma 619:78 / 619:77). */
  orange500: '#F97316',
  orange50: '#FFF1E6',

  // Company marks the notification feed draws as letter tiles (Figma 619:27 / 619:24).
  stripe: '#635BFF',
  slack: '#E01E5A',

  brand500: '#4733F9',
  brand200: '#E0DDFE',
  /** The rule between the sparkle and the text in a job card's match reason (Figma 498:24). */
  brand150: '#D9D6FE',
  brand50: '#F4F3FF',
  /**
   * Unread-notification wash (Figma 1:2422). The redesigned card (619:44) draws #F6F5FF, one step
   * deeper, which puts the card's grey time under 4.5:1; this keeps it at AA (toreview.md 59).
   */
  brand25: '#F7F6FF',
  /** The unread card's border (Figma 619:44). */
  brand75: '#ECEAFE',
  /** Brand glyph tiles on the notification cards (Figma 619:43 / 619:88). */
  brand60: '#EEEBFF',
  /** The link-kind tiles on the profile boards (Figma 577:9046 / 577:9800). */
  brand100: '#E4E4FD',
  /** The "+ New" tile's lavender wash (Figma 95:1555). */
  brand30: '#F5F4FD',
  /** The lightbulb on the cover letter's honesty note (Figma 644:145). */
  brand300: '#A59BFF',
  /** The dashed edge of ATS 01's "Or paste a job description" tile (Figma 645:37). */
  brand250: '#C7C2FF',

  green600: '#16A34A',
  /** Success text: #16A34A is 3.15:1 on green50 ("Strong match", "98% Match"). */
  green650: '#12853D',
  green500: '#22C55E',
  green400: '#4ADE80',
  green50: '#F0FDF4',
  /** Success glyph tile (Figma 619:65). */
  green60: '#E7F8EE',

  red600: '#DC2626',
  /** Danger text: #DC2626 is 4.41:1 on red50. */
  red620: '#DA2323',
  red500: '#EF4444',
  red50: '#FEF2F2',
  /** The outlined Delete button's border (Figma 573:285). */
  red200: '#FECACA',
  /** Danger letter tile (Figma 619:111). */
  red60: '#FEECEC',

  amber700: '#B45309',
  amber600: '#D97706',
  amber500: '#F59E0B',
  amber50: '#FFFBEB',

  // Onboarding & auth (Figma 307:4152). The welcome screen's brand gradient, top-left to
  // bottom-right, and the mark's own blue — which the auth landing also uses as an accent word.
  brandGradient1: '#F1EFF9',
  brandGradient2: '#8B83FC',
  brandGradient3: '#4A3FEB',
  brand600: '#3C29F6',
  /** Sign-up's primary CTA (296:3190). Was a lime until the board was revised. */
  violet400: '#9890F8',
  /** Onboarding's near-black; truer than ink900, which is a blue-grey. */
  ink950: '#08090A',
  /** Supporting copy under each onboarding heading. Large text only — 3.4:1 on white. */
  slate450: '#89909A',
  /** The muted "/ 3" in the step counter, and the inactive slide dots. */
  gray220: '#D5D9DD',
  gray250: '#D8DBE2',
  gray350: '#C9CED2',

  // Dark scheme foundations (provisional — Figma only ships light; refine when dark screens exist)
  dark900: '#0B0D12',
  dark800: '#12151C',
  dark700: '#1A1E27',
  dark600: '#262B36',
  dark500: '#3A4150',
} as const;
