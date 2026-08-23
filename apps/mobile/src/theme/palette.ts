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
  ink300: '#C4C4C6',

  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray150: '#F1F2F4',
  gray200: '#E5E7EB',

  brand500: '#4733F9',
  brand200: '#E0DDFE',
  brand50: '#F4F3FF',

  green600: '#16A34A',
  green50: '#F0FDF4',

  red600: '#DC2626',
  red500: '#EF4444',
  red50: '#FEF2F2',

  amber600: '#D97706',
  amber50: '#FFFBEB',

  // Dark scheme foundations (provisional — Figma only ships light; refine when dark screens exist)
  dark900: '#0B0D12',
  dark800: '#12151C',
  dark700: '#1A1E27',
  dark600: '#262B36',
  dark500: '#3A4150',
} as const;
