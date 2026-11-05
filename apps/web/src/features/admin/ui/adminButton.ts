import { cn } from '@/lib/cn';
import { pressable } from '@/ui/pressable';

const base =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60';

/**
 * The admin boards' buttons (Figma 394:683, 394:689, 396:737), at the board's sizes: the page
 * header's pair is 44 and 46 tall (the primary's 2px rim adds the two), a card header's is 38.
 * One whole string per look, so Tailwind reads them.
 */
export const adminButton = {
  secondary: cn(
    base,
    pressable,
    'h-11 border border-neutral-300 bg-surface-card px-3.5 text-body-m text-neutral-700 shadow-button-xs not-disabled:not-aria-disabled:hover:bg-neutral-50',
  ),
  primary: cn(
    base,
    pressable,
    'h-[46px] border-2 border-neutral-0/12 bg-brand-600 px-3.5 text-body-m text-text-inverse shadow-button-xs not-disabled:not-aria-disabled:hover:bg-brand-700',
  ),
  /** A destructive confirm (the Suspend dialog's "Suspend account", Figma 407:2695). */
  danger: cn(
    base,
    pressable,
    'h-[46px] border-2 border-neutral-0/12 bg-danger-600 px-3.5 text-body-m text-text-inverse shadow-button-xs not-disabled:not-aria-disabled:hover:bg-danger-text',
  ),
  small: cn(
    base,
    pressable,
    'h-[38px] border border-neutral-300 bg-surface-card px-3 text-body-s text-neutral-700 shadow-button-xs not-disabled:not-aria-disabled:hover:bg-neutral-50',
  ),
};

/**
 * A control the board draws whose feature isn't built yet (search, the bell, Filters). It keeps
 * the board's full-strength look, unlike the user app's dimmed `soonControl`, and says "coming
 * soon" in its tooltip; it never presses or tints (`toreview.md` §171.3).
 */
export const adminSoon = 'aria-disabled:cursor-default aria-disabled:active:scale-100';
