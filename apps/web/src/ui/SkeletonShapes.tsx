import { cn } from '@/lib/cn';

import { Skeleton } from './Skeleton';

/**
 * Silhouettes (§196, after mobile): a section's placeholder traces its loaded layout with a few
 * large shapes — a card, a logo tile, a circle, two or three short bars — never one bar per word.
 * The light runs in window space, so a silhouette made of several shapes still lights up as one
 * surface. Keep each one's outer size the loaded section's, so nothing moves when it lands.
 */

/** A title and its supporting lines: rounded bars, the first one taller. Two or three, no more. */
export function SkeletonLines({
  widths,
  className,
}: {
  /** One Tailwind width class per bar, e.g. `['w-3/4', 'w-1/2']`. */
  widths: readonly string[];
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      {widths.map((width, index) => (
        <Skeleton key={index} className={cn('rounded-full', index === 0 ? 'h-4' : 'h-3', width)} />
      ))}
    </div>
  );
}

/** An avatar, a score ring, a round icon. `className` sets the size (e.g. `size-10`). */
export function SkeletonCircle({ className }: { className: string }) {
  return <Skeleton className={cn('shrink-0 rounded-full', className)} />;
}

/**
 * A list row: a leading tile (a logo, a thumbnail, an icon), a title with one or two meta lines,
 * and an optional short bar on the right (a date, a score). `className` carries the row's own
 * height and padding, so a list of these is as long as the loaded list.
 */
export function SkeletonListRow({
  tile = 'size-10',
  round = false,
  lines = 2,
  trailing = false,
  className,
}: {
  /** The leading tile's size class; `null` for a row with none. */
  tile?: string | null;
  round?: boolean;
  lines?: 1 | 2 | 3;
  trailing?: boolean;
  className?: string;
}) {
  const widths = ['w-3/5', 'w-2/5', 'w-1/2'].slice(0, lines);
  return (
    <div aria-hidden className={cn('flex items-center gap-3', className)}>
      {tile ? (
        <Skeleton className={cn('shrink-0', round ? 'rounded-full' : 'rounded-lg', tile)} />
      ) : null}
      <SkeletonLines widths={widths} className="flex-1" />
      {trailing ? <Skeleton className="h-3 w-14 shrink-0 self-start rounded-full" /> : null}
    </div>
  );
}
