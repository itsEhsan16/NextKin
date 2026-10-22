import { cn } from '@/lib/cn';
import { JobSeekerBinocularsIllustration } from '@/ui/illustrations';

/**
 * The "Better Opportunities Ahead" character (304:2335), in the board's own 332×123 geometry. It
 * takes no row of its own: the screen places it absolutely, scales it to the compact density and
 * paints it first, so the search bar and the detail card cover its skyline as on the board.
 *
 * The source text layer reads "Better Opportuniies Ahead" — the spelling is fixed; the curly
 * quotes and the line break are the board's. Its 15px caption (Title/L) scales with the art.
 */
export function JobSeekerIllustration({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none relative h-[123px] w-[332px]', className)}>
      <JobSeekerBinocularsIllustration className="size-full" />
      <span className="absolute left-[225px] top-6 w-[104px] whitespace-pre text-center font-caveat text-title-l font-semibold text-text-caveat">
        {'“Better Opportunities\nAhead”'}
      </span>
    </div>
  );
}
