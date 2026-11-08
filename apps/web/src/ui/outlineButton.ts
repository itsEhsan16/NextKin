import { pressable } from './pressable';

/**
 * The app's secondary action beside `brandButton`: Save Job, Update Status, and the resume card's
 * Download and Use for Job. A white face with a divider-grey edge and a muted hover. A constant
 * rather than a component for the same reason `brandButton` is: height, padding, radius and type
 * stay with each caller.
 */
export const outlineButton =
  'inline-flex items-center justify-center border border-border-default bg-surface-card shadow-card ' +
  `text-neutral-800 ${pressable} not-disabled:not-aria-disabled:hover:bg-surface-muted ` +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ' +
  'disabled:opacity-60';
