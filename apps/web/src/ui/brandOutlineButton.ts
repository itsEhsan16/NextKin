import { pressable } from './pressable';

/**
 * The brand-tinted outline action: the Account cards' "Edit" (307:3519) and the Settings cards'
 * "Edit", "Change password", "Enable" and "View all" (254:493-565). A white face with the lavender
 * `border-brand-strong` edge and brand ink, washed in brand on hover. A constant rather than a
 * component for the same reason `outlineButton` is: height, padding, radius and type stay with
 * each caller.
 */
export const brandOutlineButton =
  'inline-flex items-center justify-center border border-border-brand-strong bg-surface-card ' +
  `text-brand-600 ${pressable} not-disabled:not-aria-disabled:hover:bg-surface-brand ` +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ' +
  'disabled:opacity-60';
