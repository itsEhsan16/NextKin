import Image from 'next/image';

import { cn } from '@/lib/cn';

/**
 * The character holding up a resume (307:4012), at 220×82: the board's 294×109 at the three
 * quarters the Jobs character is drawn at. It is a raster on the board, so it ships as a PNG, cut to
 * 660×245 from the 2058×764 export. The board gives it no caption. The screen places it.
 */
export function ResumesIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none h-[82px] w-[220px]', className)}>
      <Image
        // Above the fold and the page's largest paint: fetched with the page, not lazily (§84).
        loading="eager"
        src="/illustrations/resumes-hero.png"
        alt=""
        width={220}
        height={82}
        className="size-full object-contain"
      />
    </div>
  );
}
