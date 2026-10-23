import { MATCH_BAND_LABEL, type MatchBand } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { MatchSparkleIcon } from '@/ui/icons';

import { MATCH_TONE } from '../matchTone';

/**
 * "Strong match" (719:12): the list card's verdict, a band in words rather than the detail card's
 * percentage. Renders nothing for a job that hasn't been matched yet, as `MatchBadge` does.
 */
export function MatchPill({ band }: { band?: MatchBand | undefined }) {
  if (band == null) return null;
  const tone = MATCH_TONE[band];

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-2.5 pr-3 text-caption-m font-semibold',
        tone.surface,
        tone.text,
      )}
    >
      <MatchSparkleIcon className="h-auto w-3.5 shrink-0" />
      {MATCH_BAND_LABEL[band]}
    </span>
  );
}
