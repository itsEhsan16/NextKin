import type { MatchBand } from '@nextkin/shared/models';

import { SCORE_TONE } from '@/ui/scoreTone';

/**
 * `MatchBand` → the one honest score scale (redesign R3c, `ui/scoreTone.ts`): Strong green, Good
 * grey, Fair amber, Weak red. Good, Fair and Weak used to share one grey, so a weak match read like
 * a fair one (audit JB-03).
 */
export const MATCH_TONE: Record<MatchBand, { surface: string; text: string }> = SCORE_TONE;
