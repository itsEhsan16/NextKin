/**
 * Pure geometry for SwipeableRow, extracted because RNGH's Gesture.Pan cannot be driven by
 * the test renderer (the RangeSlider precedent).
 */

/** One revealed action panel is 84pt wide (Figma 1:2542). */
export const SWIPE_ACTION_WIDTH = 84;

/** Left-swipe only: displacement is clamped to [-rowWidth, 0]. */
export function clampSwipe(translation: number, rowWidth: number): number {
  'worklet';
  return Math.max(-rowWidth, Math.min(0, translation));
}

export type SwipeSnap = 'closed' | 'open' | 'commit';

/** Past this fraction of the row, releasing commits the primary action (note 1:2600). */
export const COMMIT_FRACTION = 0.55;

/**
 * Where a released swipe settles: back closed, resting on the action panels, or committing
 * the primary action (a full swipe). Velocity lets a decisive flick win over distance.
 */
export function resolveSwipeSnap(
  translation: number,
  velocity: number,
  actionsWidth: number,
  rowWidth: number,
): SwipeSnap {
  'worklet';
  const x = clampSwipe(translation, rowWidth);
  // A rightward flick always closes, no matter where the row sits.
  if (velocity > 300) return 'closed';
  if (x < -rowWidth * COMMIT_FRACTION) return 'commit';
  if (x < -actionsWidth / 2 || velocity < -300) return 'open';
  return 'closed';
}
