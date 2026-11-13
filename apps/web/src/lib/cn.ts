import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

import { typography } from '@/theme/tokens';

/**
 * tailwind-merge resolves conflicts by class *group*, and out of the box it only knows Tailwind's
 * stock scales. This project renames the type ramp after the board's roles, so `text-body-m` and
 * `text-text-inverse` both read to it as an unrecognised `text-*` — it puts them in one group and
 * keeps whichever came last. That silently dropped the size from every nav label and the white
 * from the "Upgrade Now" button.
 *
 * Naming the roles fixes it: they become the `font-size` group, and every other `text-*` stays a
 * colour. Derived from `typography` so a role added to the ramp cannot be forgotten here —
 * `__tests__/theme/tokens.test.ts` holds the two together.
 */
const fontSizes = Object.keys(typography).map((role) =>
  role.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
);

/**
 * The scale names redesign R8 added in place of arbitrary values (`h-[7px]` became `h-progress`).
 * tailwind-merge knew the arbitrary values as a height or a radius; unnamed, the tokens would not
 * be, and a caller's `h-1.5` would stop replacing the component's default. Naming them keeps every
 * override working exactly as before. `__tests__/lib/cn.test.ts` checks each against `theme.css`.
 *
 * Deliberately NOT named: the tokens from before R8 (`control-*`, `aside-*`, `card`, the z-layers…).
 * tailwind-merge has never grouped them, so some callers' overrides (`h-8` on an `h-control-sm`
 * button) have silently lost to them, and the screens were approved that way. Naming them would
 * change those screens, and the owner chose to keep them (2026-11-13, tracker §27).
 */
export const THEME_SCALES = {
  spacing: [
    'topbar',
    'page-fill',
    'below-topbar',
    'sidebar-inset',
    'aside-slim',
    'indicator',
    'progress',
    'dialog-sm',
    'dialog-md',
    'dialog-lg',
    'dialog-xl',
  ],
  radius: ['hairline', 'xs', 'checkbox', 'tag', 'admin-sm', 'admin-md'],
  shadow: ['hairline-bottom', 'brand-glow'],
  tracking: ['snug', 'heading', 'title', 'display', 'label', 'caps', 'caps-wide', 'overline'],
  container: ['admin-xs', 'admin-sm', 'admin-md', 'admin-lg', 'admin-xl', 'admin-2xl'],
} as const;

/** The R8 `@utility` classes: the layer behind a box's content, and the three transition sets. */
export const Z_LAYERS = ['behind'] as const;
export const TRANSITIONS = ['field', 'width', 'card'] as const;

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: [...THEME_SCALES.spacing],
      radius: [...THEME_SCALES.radius],
      shadow: [...THEME_SCALES.shadow],
      tracking: [...THEME_SCALES.tracking],
      container: [...THEME_SCALES.container],
    },
    classGroups: {
      'font-size': fontSizes.map((size) => `text-${size}`),
      z: [{ z: [...Z_LAYERS] }],
      transition: [{ transition: [...TRANSITIONS] }],
    },
  },
});

/** Merge conditional class names, letting a caller's utility win over a component's default. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
