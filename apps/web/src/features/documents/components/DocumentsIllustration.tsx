import Image from 'next/image';

import { cn } from '@/lib/cn';

/**
 * The folder of documents (304:683), as the art of the preview's empty states (owner, toreview
 * §253: it no longer rises over the preview card's corner with its "Organize, Prepare, Go Further"
 * caption; it sits in the card while there is nothing to preview). A raster on the board, so the
 * WebP; it sizes by width and keeps its own shape.
 */
export function DocumentsIllustration({ className }: { className?: string }) {
  return (
    <Image
      aria-hidden
      // Fetched with the page, so the empty card never shows without its art.
      loading="eager"
      src="/illustrations/v2/documents.webp"
      alt=""
      width={560}
      height={494}
      className={cn('pointer-events-none h-auto w-44 object-contain', className)}
    />
  );
}
