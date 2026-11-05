import { colors } from '@/theme/tokens';

/**
 * Clerk's sign-in and sign-up forms, drawn in web's own tokens (toreview §169). Clerk derives
 * hover, border and focus shades from these, so they are the token values (`tokens.ts`), not
 * `var(--…)` references, which it cannot mix. Clerk keeps its own card layout; only its heading
 * is hidden, because the page's heading stands above it.
 */
export const clerkAppearance = {
  // Clerk's styles go in this cascade layer, which theme.css orders before Tailwind's utilities,
  // so the one class below wins (Tailwind v4).
  cssLayerName: 'clerk',
  variables: {
    colorPrimary: colors.brand600,
    colorPrimaryForeground: colors.textInverse,
    colorDanger: colors.dangerText,
    colorForeground: colors.textPrimary,
    colorMutedForeground: colors.textSecondary,
    colorBackground: colors.surfaceCard,
    colorInput: colors.surfaceCard,
    colorInputForeground: colors.textPrimary,
    colorBorder: colors.borderDefault,
    colorRing: colors.borderSelected,
    fontFamily: 'var(--font-sans)',
  },
  options: { socialButtonsPlacement: 'bottom' as const, logoPlacement: 'none' as const },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full max-w-none',
    header: 'hidden',
  },
};
