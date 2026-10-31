/** How close to the end (pt) still counts as "reading the latest" for `followEnd`. */
export const FOLLOW_END_SLOP = 48;

type ScrollMetrics = {
  contentOffset: { y: number };
  layoutMeasurement: { height: number };
  contentSize: { height: number };
};

/**
 * Whether the viewport sits at (or within the slop of) the end of the content. A worklet: the
 * scroll handler evaluates it on the UI thread for every frame of a scroll.
 *
 * The default is resolved in the body, never as a parameter default: the worklets plugin only
 * captures what the body references, so `slop = FOLLOW_END_SLOP` left the constant behind on the
 * UI thread. The first scroll threw a ReferenceError there, which killed Expo Go outright on
 * Android with no red screen (toreview §138.7).
 */
export function isAtEnd(event: ScrollMetrics, slop?: number): boolean {
  'worklet';
  const margin = slop ?? FOLLOW_END_SLOP;
  return (
    event.contentOffset.y + event.layoutMeasurement.height >= event.contentSize.height - margin
  );
}
