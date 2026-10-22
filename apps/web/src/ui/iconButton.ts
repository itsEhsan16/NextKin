import { pressable } from './pressable';

/**
 * A glyph-only action in a row: a device's or an account's kebab, a Privacy & data chevron. The
 * caller adds the ink. A constant rather than a component, like `outlineButton`.
 */
export const iconButton =
  `flex size-control-sm items-center justify-center rounded-sm ${pressable} ` +
  'not-disabled:not-aria-disabled:hover:bg-surface-muted ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
