import { pressable } from './pressable';

/**
 * The destructive outline action: Privacy & data's "Delete my data". A white face with a soft red
 * edge and red ink, washed in the danger tint on hover, beside `outlineButton` and
 * `brandOutlineButton`. On that tint the ink darkens, since the danger red alone is under 4:1
 * there. A constant rather than a component for the same reason they are.
 */
export const dangerOutlineButton =
  'inline-flex items-center justify-center border border-border-danger bg-surface-card ' +
  `text-danger-600 ${pressable} not-disabled:not-aria-disabled:hover:bg-danger-50 ` +
  'not-disabled:not-aria-disabled:hover:text-danger-text focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-danger-600 disabled:opacity-60';
