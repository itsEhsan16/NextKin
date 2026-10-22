import { cn } from '@/lib/cn';
import { NotificationsHeroIllustration } from '@/ui/illustrations';

/**
 * The handwritten note and the character with her phone (257:2368, 257:2317), at 272×116: the
 * board's 312×133 at 0.87, as tall as the Account section's character (`toreview.md` §25.3). The
 * two are separate groups on the
 * board, exported apart and joined at their board offsets into one drawing. The note keeps its
 * words as the export's outlines: at this size the card is too small for live Caveat text at the
 * other captions' 15px. The board seats her on the card's top edge, a sixth of its width in from
 * the right.
 */
export function NotificationsIllustration({ className }: { className?: string }) {
  return (
    <NotificationsHeroIllustration
      className={cn('pointer-events-none h-[116px] w-[272px]', className)}
    />
  );
}
