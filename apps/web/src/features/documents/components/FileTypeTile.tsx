import type { CareerDocumentFormat } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { FORMAT_LABEL } from '../documentLibrary';

/** The sheet's ink per format, and the ground the board sets each on (286:2120 and on). */
const INK: Record<CareerDocumentFormat, string> = {
  pdf: 'bg-file-pdf',
  docx: 'bg-file-docx',
  xlsx: 'bg-file-xlsx',
  jpg: 'bg-file-jpg',
};

const GROUND: Record<CareerDocumentFormat, string> = {
  pdf: 'bg-neutral-50',
  docx: 'bg-brand-50',
  xlsx: 'bg-neutral-100',
  jpg: 'bg-neutral-50',
};

/**
 * `row` in a list row (286:2120), `card` at the head of the detail card (286:2220), `preview` alone.
 * The board's tiles are its lists' largest (60px), so these are 48 where the other lists' are 44.
 * The label can't go under the ramp's 11px, and "DOCX" is 33px wide at that size: a 40px sheet
 * is what gives it a margin.
 */
const SIZE = {
  row: { ground: 'size-12', sheet: 'h-11 w-10' },
  card: { ground: 'size-12', sheet: 'size-10' },
  preview: { ground: 'size-16', sheet: 'h-[52px] w-[46px]' },
} as const;

/** A file's tile: a coloured sheet naming its format, on a pale ground. */
export function FileTypeTile({
  format,
  size,
}: {
  format: CareerDocumentFormat;
  size: keyof typeof SIZE;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        SIZE[size].ground,
        GROUND[format],
      )}
    >
      <div
        className={cn(
          'flex items-end justify-center rounded-sm pb-1.5 text-micro font-semibold text-text-inverse',
          SIZE[size].sheet,
          INK[format],
        )}
      >
        {FORMAT_LABEL[format]}
      </div>
    </div>
  );
}
