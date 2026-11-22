import Image from 'next/image';

import { cn } from '@/lib/cn';

/**
 * The character holding up a resume (307:4012), as the art of the preview's empty states, as
 * Documents' folder is (toreview §254: it no longer rises over the preview card's corner). A
 * raster on the board, so the WebP; it sizes by width and keeps its own shape, and loads with the
 * page so the empty card never shows without it.
 */
export function ResumesIllustration({ className }: { className?: string }) {
  return (
    <Image
      aria-hidden
      loading="eager"
      src="/illustrations/v2/resumes.webp"
      alt=""
      width={560}
      height={462}
      className={cn('pointer-events-none h-auto w-44 object-contain', className)}
    />
  );
}
