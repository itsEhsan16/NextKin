/**
 * How long a sheet takes to close from where it is. Fully open, that is the token's full time;
 * dragged most of the way down, only the rest of the distance is left, so it finishes in a
 * proportional share of it — never below `min`, so the last stretch still reads as motion.
 *
 * A worklet-safe pure function, so it is testable without a renderer.
 */
export function closeDuration(
  remaining: number,
  { min, max }: { min: number; max: number },
): number {
  'worklet';
  const share = Math.min(1, Math.max(0, remaining));
  return Math.max(min, Math.round(max * share));
}
