import type { MatchBand } from '@nextkin/shared/models';

import { ScoreVerdict } from '@/ui/ScoreVerdict';

/**
 * "Strong match" (719:12): the list card's verdict, a band in words rather than the detail card's
 * percentage. Now `ScoreVerdict`'s `pill` (redesign R3c). Nothing for a job not matched yet.
 */
export function MatchPill({ band }: { band?: MatchBand | undefined }) {
  return <ScoreVerdict variant="pill" kind="match" {...(band ? { band } : {})} />;
}
