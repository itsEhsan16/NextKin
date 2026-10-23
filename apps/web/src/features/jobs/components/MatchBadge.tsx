import type { MatchBand } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { MATCH_TONE } from '../matchTone';

export type MatchBadgeProps = { score?: number; band?: MatchBand };

/**
 * "98% Match" (304:2491) — the same 20px badge on the list card and in the detail card. Renders
 * nothing without a score, mirroring `TopJobMatches`' guard.
 */
export function MatchBadge({ score, band }: MatchBadgeProps) {
  if (score == null) return null;
  const tone = MATCH_TONE[band ?? 'strong'];

  return (
    <span
      className={cn(
        'whitespace-nowrap rounded-sm px-2 py-0.5 text-caption-m font-bold leading-4',
        tone.surface,
        tone.text,
      )}
    >
      {Math.round(score * 100)}% Match
    </span>
  );
}
