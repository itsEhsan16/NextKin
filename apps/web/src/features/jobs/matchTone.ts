import type { MatchBand } from '@nextkin/shared/models';

/**
 * `MatchBand` → an existing semantic token, not a bespoke "match" colour — the same call mobile's
 * own `MATCH_TONE`/`MATCH_RING_COLOR` maps make (`apps/mobile/src/features/jobs/components/
 * JobPills.tsx`), reusing success/warning/neutral rather than adding new tokens for this one
 * role. The Jobs board's green "XX% Match" badge already matches `success-surface`/`success-text`
 * exactly, so `strong` needs no new value at all; `good`/`fair` are undrawn on this board (every
 * example card is `strong`), so their mapping follows mobile's own precedent rather than Figma.
 */
export const MATCH_TONE: Record<MatchBand, { surface: string; text: string }> = {
  strong: { surface: 'bg-success-surface', text: 'text-success-text' },
  good: { surface: 'bg-surface-muted', text: 'text-text-secondary' },
  fair: { surface: 'bg-surface-muted', text: 'text-text-tertiary' },
  // `weak` (C-10) is undrawn, but it must not read like fair (audit JB-03), so it takes the
  // warning tone. Mobile still shows it neutral (`JobPills.tsx`); align it there when mobile is next touched.
  weak: { surface: 'bg-warning-50', text: 'text-warning-text' },
};
