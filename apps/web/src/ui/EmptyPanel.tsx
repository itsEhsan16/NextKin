import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';

import { cardSurface } from './Card';

/**
 * A two-column page with nothing in it yet (owner, 2026-11-15: an empty Applications or Documents
 * page kept neither column's shape, with art floating on the bare page and a short card beside
 * it). Empty, each column is still what it is when filled, in the same place and to the same
 * depth:
 *
 * - `emptyList` is the list's own area as one dashed outline, where the rows will be;
 * - `emptyDetail` is the detail card itself, as tall as its column, with one quiet line in it.
 *
 * The outline and the card end on the same line, so the page reads as its two columns whether or
 * not there is anything in them. Only the list carries the illustration and the way onward: two
 * drawings side by side said the same thing twice.
 */
export const emptyList =
  'flex h-full min-h-80 items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-card/60';

export const emptyDetail = cn(cardSurface, 'flex min-h-80 flex-1 items-center justify-center p-6');

/** The quiet mark in an empty detail card: the thing it will hold, as a line icon in a soft tile. */
export function EmptyMark({ icon: Icon }: { icon: ComponentType<SVGProps<SVGSVGElement>> }) {
  return (
    <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-text-brand">
      <Icon className="size-6" />
    </span>
  );
}
