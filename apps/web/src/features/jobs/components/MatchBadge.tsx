import type { MatchBand } from '@nextkin/shared/models';

import { ScoreVerdict } from '@/ui/ScoreVerdict';

export type MatchBadgeProps = { score?: number; band?: MatchBand };

/**
 * "98% Match" (304:2491): the job card's and detail card's badge, now `ScoreVerdict`'s `badge`
 * (redesign R3c). Nothing without a score and a band: a missing band used to fall back to green
 * "strong", a flattering default (audit JB-03). `score` is 0–1, as the job carries it.
 */
export function MatchBadge({ score, band }: MatchBadgeProps) {
  return (
    <ScoreVerdict
      variant="badge"
      kind="match"
      {...(score != null ? { score: score * 100 } : {})}
      {...(band ? { band } : {})}
    />
  );
}
