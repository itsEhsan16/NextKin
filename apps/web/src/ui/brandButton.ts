import { pressable } from './pressable';

/**
 * The app's flat primary action, as a class string: Upload New JD, the Jobs page's Search, Apply
 * Now. One look on every page since the compact pass (`toreview.md` §16) — Home's `brand-600`,
 * with `brand-700` as its hover. Home's bevelled `primaryButton` stays only where its boards draw
 * a bevel (the AI card, the sidebar's Upgrade).
 *
 * A constant rather than a component for the same reason `primaryButton` is: height, padding,
 * radius and weight stay with each caller.
 */
export const brandButton =
  `inline-flex items-center justify-center bg-brand-600 text-text-inverse shadow-button ${pressable} ` +
  'not-disabled:not-aria-disabled:hover:bg-brand-700 focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60';
