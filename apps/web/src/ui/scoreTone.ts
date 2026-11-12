/**
 * How a score band looks, everywhere (redesign R3c, `doc/redesign/02-tokens.md` §3.6). Five
 * screens used to keep their own band→colour map, and most drew Good in the same green as Strong
 * (and Fair and Weak in one grey), so a middling score read as a strong one.
 *
 * The honest scale: Strong green, Good a grey surface with an indigo arc (owner, 2026-11-12), Fair
 * amber, Weak red. The colour belongs to the band, never to the number, and there is no default:
 * a score with no band shows no colour at all.
 */
export type ScoreBand = 'strong' | 'good' | 'fair' | 'weak';

/** The ring's arc tone; `ScoreRing` turns it into a colour. */
export type RingTone = 'success' | 'brand' | 'warning' | 'danger';

export const SCORE_TONE: Record<ScoreBand, { surface: string; text: string; arc: RingTone }> = {
  strong: { surface: 'bg-score-strong-surface', text: 'text-score-strong-text', arc: 'success' },
  good: { surface: 'bg-score-good-surface', text: 'text-score-good-text', arc: 'brand' },
  fair: { surface: 'bg-score-fair-surface', text: 'text-score-fair-text', arc: 'warning' },
  weak: { surface: 'bg-score-weak-surface', text: 'text-score-weak-text', arc: 'danger' },
};
