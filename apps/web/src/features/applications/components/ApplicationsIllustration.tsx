import Image from 'next/image';

import { cn } from '@/lib/cn';

/**
 * The checklist character and its "Small steps / Big opportunities" caption (304:3093, 286:1672),
 * at 189×92. That is the Jobs character's height, and the board's 285×139 shrunk by as much as
 * the compact header shrinks the board's. The screen places it where the board does, whatever the
 * width and whether the sidebar is open or not.
 *
 * The drawing is a raster on the board, so it ships as a PNG, cut from the 1798×875 export. The
 * caption is live text in the handwritten face (Caveat, brand/600) at the Jobs caption's size,
 * set where the board sets it: just inside the drawing's right edge, beside its upper half.
 */
export function ApplicationsIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none relative h-[92px] w-[189px]', className)}>
      <Image
        // Above the fold and the page's largest paint: fetched with the page, not lazily (§84).
        loading="eager"
        src="/illustrations/applications-progress.png"
        alt=""
        width={189}
        height={92}
        className="size-full object-contain"
      />
      <span className="absolute left-[177px] top-2 whitespace-pre font-caveat text-title-l font-normal text-brand-600">
        {'Small steps\nBig opportunities'}
      </span>
    </div>
  );
}
