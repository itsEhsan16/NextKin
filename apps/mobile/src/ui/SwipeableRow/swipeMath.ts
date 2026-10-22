/**
 * Pure geometry for SwipeableRow, extracted because RNGH's Gesture.Pan cannot be driven by
 * the test renderer (the RangeSlider precedent).
 */

/**
 * One revealed action button, in artboard units: 69 at 390. Figma 1:2542 drew 84 (63 at 390),
 * which left "Mark read" touching both edges of its button on a device.
 */
export const SWIPE_ACTION_WIDTH = 92;

/** Left-swipe only: displacement is clamped to [-rowWidth, 0]. */
export function clampSwipe(translation: number, rowWidth: number): number {
  'worklet';
  return Math.max(-rowWidth, Math.min(0, translation));
}

export type SwipeSnap = 'closed' | 'open' | 'commit';

/** Past this fraction of the row, releasing commits the primary action (note 1:2600). */
export const COMMIT_FRACTION = 0.55;

/** Whether a row displaced by `x` is past the full-swipe line. */
export function isPastCommit(x: number, rowWidth: number): boolean {
  'worklet';
  return x < -rowWidth * COMMIT_FRACTION;
}

/**
 * Where a released swipe settles: back closed, resting on the action panels, or committing
 * the primary action (a full swipe). Velocity lets a decisive flick win over distance. A row with
 * nothing to commit (`canCommit` false, e.g. one already read) rests open instead.
 */
export function resolveSwipeSnap(
  translation: number,
  velocity: number,
  actionsWidth: number,
  rowWidth: number,
  canCommit = true,
): SwipeSnap {
  'worklet';
  const x = clampSwipe(translation, rowWidth);
  // A rightward flick always closes, no matter where the row sits.
  if (velocity > 300) return 'closed';
  if (isPastCommit(x, rowWidth)) return canCommit ? 'commit' : 'open';
  if (x < -actionsWidth / 2 || velocity < -300) return 'open';
  return 'closed';
}
