import { pressable } from './pressable';

/**
 * Every button look in one place (redesign R3b, `doc/redesign/03-component-inventory.md` Button).
 * Nine helpers used to restate these, and the same "primary" rendered three ways: bevelled, flat
 * with a shadow, and flat without. `Button`/`buttonClass` read this map, and the old helper names
 * (`brandButton`, `outlineButton`, …) are aliases of its entries until every caller moves (R8).
 *
 * Whole literal strings on purpose: Tailwind finds classes by scanning source text, so a class
 * built by concatenation at runtime would never be generated.
 *
 * Fills read the semantic `action-*` tokens (02-tokens §3.4), so a dark theme re-points them in
 * one place. Disabled is the rest look at `opacity-60` with no hover and no press.
 */
const BASE = `inline-flex items-center justify-center ${pressable} focus-visible:outline-2 focus-visible:outline-offset-2`;

export const BUTTON_VARIANT = {
  /** The one everyday primary: flat brand, deeper on hover and press (the bevel is retired). */
  primary: `${BASE} bg-action-primary text-text-on-brand shadow-button not-disabled:not-aria-disabled:hover:bg-action-primary-hover not-disabled:not-aria-disabled:active:bg-action-primary-pressed focus-visible:outline-focus-ring disabled:opacity-60`,
  /** A neutral outline beside the primary: Cancel, Back, secondary choices. */
  secondary: `${BASE} border border-border-default bg-action-secondary text-neutral-800 shadow-card not-disabled:not-aria-disabled:hover:bg-action-secondary-hover focus-visible:outline-focus-ring disabled:opacity-60`,
  /** An outline in brand: an action that matters but isn't the page's one primary. */
  'brand-secondary': `${BASE} border border-border-brand-strong bg-surface-card text-text-brand not-disabled:not-aria-disabled:hover:bg-surface-brand focus-visible:outline-focus-ring disabled:opacity-60`,
  /** No chrome until hovered: toolbar actions, "Edit" in a card header. */
  ghost: `${BASE} text-text-secondary not-disabled:not-aria-disabled:hover:bg-action-ghost-hover not-disabled:not-aria-disabled:hover:text-text-primary focus-visible:outline-focus-ring disabled:opacity-60`,
  /** Solid red: the commit in a destructive confirmation, never a page's everyday action. */
  danger: `${BASE} bg-action-danger text-text-on-brand not-disabled:not-aria-disabled:hover:bg-action-danger-hover not-disabled:not-aria-disabled:active:bg-action-danger-pressed focus-visible:outline-focus-ring-danger disabled:opacity-60`,
  /** A red outline: a destructive action offered, not yet confirmed. */
  'danger-secondary': `${BASE} border border-border-danger bg-surface-card text-danger-600 not-disabled:not-aria-disabled:hover:bg-danger-50 not-disabled:not-aria-disabled:hover:text-danger-text focus-visible:outline-focus-ring-danger disabled:opacity-60`,
  /** Fuchsia: Pro and upgrade only (owner, 2026-11-12). Never a product action. */
  paid: `${BASE} bg-action-paid text-text-on-brand not-disabled:not-aria-disabled:hover:bg-action-paid-hover not-disabled:not-aria-disabled:active:bg-action-paid-pressed focus-visible:outline-action-paid disabled:opacity-60`,
  /** Ink: reserved for a flow's final commit, so the end of a flow looks different. */
  inverse: `${BASE} bg-action-inverse text-text-inverse not-disabled:not-aria-disabled:hover:bg-action-inverse-hover not-disabled:not-aria-disabled:active:bg-action-inverse-pressed focus-visible:outline-focus-ring disabled:opacity-60`,
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANT;

/** Heights from the control tokens; padding, gap and type step with them. */
export const BUTTON_SIZE = {
  sm: 'h-control-sm gap-1.5 rounded-md px-3.5 text-body-m font-semibold',
  md: 'h-control-md gap-2 rounded-md px-4 text-body-m font-semibold',
  lg: 'h-control-lg gap-2 rounded-md px-5 text-body-l font-semibold',
  xl: 'h-control-xl gap-2.5 rounded-lg px-6 text-body-l font-semibold',
} as const;

/** Square, for an icon with an `aria-label` and no text. */
export const ICON_BUTTON_SIZE = {
  sm: 'size-control-sm rounded-md',
  md: 'size-control-md rounded-md',
  lg: 'size-control-lg rounded-md',
  xl: 'size-control-xl rounded-lg',
} as const;

export type ButtonSize = keyof typeof BUTTON_SIZE;
