import { Skeleton } from './Skeleton';

export type DetailCardSkeletonProps = {
  /** The row of tag pills under the actions (the job card has one; the application card doesn't). */
  tags?: boolean;
  /** How many lines of prose the block under the tabs stands for (one block, their height). */
  lines?: number;
};

/**
 * The inside of a job or application detail card while it loads, laid out like the loaded card:
 * the 32px logo and its badge, the title, company and meta lines, the two actions, the tabs and
 * the first lines of the description, on the card's own spacing.
 *
 * Sized like what replaces it, so the card doesn't collapse to a stub and then grow when the
 * content lands (`toreview.md` §84). It used to be four blocks about 250px tall in front of a
 * card that fills the column.
 */
export function DetailCardSkeleton({ tags = false, lines = 9 }: DetailCardSkeletonProps) {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="flex items-start justify-between">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="mt-3 h-6 w-2/3" />
      <Skeleton className="mt-1.5 h-4 w-1/4" />
      <Skeleton className="mt-2.5 h-4 w-3/4" />
      <div className="mt-3.5 grid grid-cols-2 gap-3">
        <Skeleton className="h-control-lg rounded-md" />
        <Skeleton className="h-control-lg rounded-md" />
      </div>
      {tags && (
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      )}
      <Skeleton className="mt-4 h-9 w-full" />
      {/* The description as one block in its lines' height (§196), not a bar per line. */}
      <Skeleton className="mt-4 w-full rounded-lg" style={{ height: `${lines * 1.5}rem` }} />
    </div>
  );
}
