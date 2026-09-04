/**
 * Pure geometry for RangeSlider, deliberately kept out of the component.
 *
 * The gesture handlers call these on the UI thread, but RNGH's `Gesture.Pan` cannot be driven by
 * the testing library — so extracting the maths is the only way the drag logic gets real coverage.
 * Worklets are ordinary JS under Jest, so every function here is unit-testable as-is.
 */

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/** Snap to the nearest `step` measured from `min`, then clamp into range. */
export function quantise(value: number, min: number, max: number, step: number): number {
  'worklet';
  if (step <= 0) return clamp(value, min, max);
  return clamp(min + Math.round((value - min) / step) * step, min, max);
}

/** Where `value` sits along the track, 0–1. */
export function fractionOf(value: number, min: number, max: number): number {
  'worklet';
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

/** Inverse of `fractionOf`: a thumb's pixel offset along the travel, back to a stepped value. */
export function pxToValue(
  px: number,
  min: number,
  max: number,
  travel: number,
  step: number,
): number {
  'worklet';
  if (travel <= 0) return min;
  return quantise(min + (px / travel) * (max - min), min, max, step);
}

/**
 * Thumbs clamp against each other rather than swapping: a swap mid-drag moves the value under the
 * user's finger and, worse, hands screen-reader focus to a different control than the one being
 * adjusted. The low thumb's ceiling is the high thumb less the minimum gap.
 */
export function clampLow(next: number, min: number, high: number, minDistance: number): number {
  'worklet';
  return clamp(next, min, Math.max(min, high - minDistance));
}

export function clampHigh(next: number, low: number, max: number, minDistance: number): number {
  'worklet';
  return clamp(next, Math.min(max, low + minDistance), max);
}
