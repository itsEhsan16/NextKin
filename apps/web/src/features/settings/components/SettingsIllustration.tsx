import { cn } from '@/lib/cn';
import { SettingsHeroIllustration } from '@/ui/illustrations';

/**
 * The character at her laptop (254:1170), at 296×116: the board's 368×144 at 0.8, taller than
 * other pages' 92px characters because the stacked header gives her the height from under its
 * buttons down to the first card (`toreview.md` §25.3). The board sits her on the first card's top
 * edge at its right end, which is where the screen anchors her, whatever the width and whether the
 * sidebar is open. A vector on the board, so it is generated like the Jobs character rather than
 * cut to a PNG.
 */
export function SettingsIllustration({ className }: { className?: string }) {
  return (
    <SettingsHeroIllustration
      className={cn('pointer-events-none h-[116px] w-[296px]', className)}
    />
  );
}
