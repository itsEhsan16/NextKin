import { BUTTON_VARIANT } from './buttonStyles';

/**
 * The app's flat primary action, as a class string: Upload New JD, the Jobs page's Search, Apply
 * Now. One look on every page since the compact pass (`toreview.md` §16) — Home's `brand-600`,
 * with `brand-700` as its hover. An alias of `BUTTON_VARIANT.primary` since redesign R3b; new code
 * uses `Button` or `buttonClass`, where height, padding and radius come with the size.
 */
export const brandButton = BUTTON_VARIANT.primary;
