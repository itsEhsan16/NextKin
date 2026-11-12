import Image from 'next/image';

import { cn } from '@/lib/cn';

/**
 * The character with a folder of documents (304:683), at 248×92: the Jobs and Applications
 * characters' height, the board's 354×131 at seven tenths. A raster on the board, so a PNG, cut to
 * 744×276 from the 2059×764 export. The caption (307:4007) is live text in the handwritten face,
 * where the board sets it: to the character's right, just above the card. The board opens its
 * quote and never closes it; this closes it.
 */
export function DocumentsIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none relative h-[92px] w-[248px]', className)}>
      <Image
        // Above the fold and the page's largest paint: fetched with the page, not lazily (§84).
        loading="eager"
        src="/illustrations/v2/documents.webp"
        alt=""
        width={560}
        height={494}
        className="size-full object-contain"
      />
      <span className="absolute left-[232px] top-[20px] whitespace-pre text-center font-caveat text-title-l font-semibold text-text-caveat">
        {'“Organize\nPrepare\nGo Further”'}
      </span>
    </div>
  );
}
