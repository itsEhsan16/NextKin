import { cn } from '@/lib/cn';

import { pageFrameInBar } from './pageFrame';
import { Skeleton } from './Skeleton';
import { SkeletonLines } from './SkeletonShapes';

/**
 * What a route that is rendered on request shows while the server works on it (§196): the page's
 * title lines and its main column as one block, next to an aside. The routes' `loading.tsx` use
 * it, which also lets `<Link>` prefetch them, so a click answers at once instead of leaving the
 * old page up (and clickable) until the new one arrives. The skeleton's own delay means a quick
 * response goes straight to the page.
 */
export function RouteSkeleton({ aside = true }: { aside?: boolean }) {
  return (
    <div aria-busy aria-label="Loading" className={cn(pageFrameInBar, 'flex flex-col gap-6 pb-10')}>
      <SkeletonLines widths={['w-64', 'w-96 max-w-full']} className="gap-3 py-2" />
      <div className="flex gap-6">
        <Skeleton className="h-[36rem] min-w-0 flex-1 rounded-lg" />
        {aside ? <Skeleton className="hidden h-80 w-80 shrink-0 rounded-lg lg:block" /> : null}
      </div>
    </div>
  );
}
