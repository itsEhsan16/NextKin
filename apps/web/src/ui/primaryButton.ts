import { pressable } from './pressable';

/**
 * The primary button's drawn treatment, as a class string.
 *
 * Both boards draw a primary button as two stacked shapes rather than one flat fill — the AI
 * card's "Ask AI Assistant" (286:722/723) and the sidebar's "Upgrade Now" (304:585) alike: a
 * lighter rim with a deeper face inset about a pixel inside it, which reads as a soft bevel. In
 * CSS that is a 1px `button-rim` border over a `button-face` background, which gets the same
 * optics from one element and still takes a hover, a focus ring and a disabled state.
 *
 * It is a constant rather than a component because the two call sites are a `Link` and a
 * `button`; size and padding stay with the caller, since the board gives them different boxes
 * (175x40 on Home, 206x28 in the sidebar).
 */
export const primaryButton =
  'inline-flex items-center justify-center rounded-sm border border-button-rim bg-button-face ' +
  `font-semibold text-text-inverse ${pressable} ` +
  'not-disabled:not-aria-disabled:hover:bg-button-rim focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-brand-600';
