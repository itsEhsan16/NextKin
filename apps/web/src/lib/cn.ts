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

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': fontSizes.map((size) => `text-${size}`) } },
});

/** Merge conditional class names, letting a caller's utility win over a component's default. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
