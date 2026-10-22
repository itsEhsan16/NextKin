import type { ResumeAccent } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { File06 } from '@/ui/lineIcons';

const ACCENT: Record<ResumeAccent, string> = {
  indigo: 'bg-tile-indigo text-tile-indigo-ink',
  pink: 'bg-tile-pink text-tile-pink-ink',
  blue: 'bg-tile-blue text-tile-blue-ink',
  green: 'bg-tile-green text-tile-green-ink',
  amber: 'bg-tile-amber text-tile-amber-ink',
};

export type ResumeTileProps = {
  accent?: ResumeAccent;
  /** `row`: 44px in a list row (304:3127). `card`: 48px at the head of the detail card (304:3260). */
  size: 'row' | 'card';
};

/**
 * A document's tile: the one document glyph on the document's own tint. A document without a tint
 * of its own (one just created) takes the brand tint.
 */
export function ResumeTile({ accent = 'indigo', size }: ResumeTileProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        size === 'row' ? 'size-11' : 'size-12',
        ACCENT[accent],
      )}
    >
      <File06 className={size === 'row' ? 'size-5' : 'size-6'} />
    </div>
  );
}
