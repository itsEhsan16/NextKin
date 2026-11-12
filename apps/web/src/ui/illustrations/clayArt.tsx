import type { CSSProperties, SVGProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * One of the clay scene illustrations (redesign, 2026-11-13: generated in Figma Weave, GPT Image
 * 2.6, to match the mobile app's clay set; files in `public/illustrations/v2`). The scene components
 * kept their names and their SVG-shaped props, so every call site and every `Art` map still works:
 * they take `className` and `style` and draw the image, decorative and hidden from screen readers.
 */
export function clayArt(src: string, width: number, height: number, name: string) {
  function ClayArt({ className, style }: SVGProps<SVGSVGElement>) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a fixed, pre-sized WebP; nothing for next/image to optimise
      <img
        src={src}
        alt=""
        aria-hidden
        width={width}
        height={height}
        draggable={false}
        decoding="async"
        className={cn('select-none object-contain', className)}
        style={style as CSSProperties | undefined}
      />
    );
  }
  ClayArt.displayName = name;
  return ClayArt;
}
