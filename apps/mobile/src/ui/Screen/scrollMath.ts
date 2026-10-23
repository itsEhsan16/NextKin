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
 */
export function isAtEnd(event: ScrollMetrics, slop: number = FOLLOW_END_SLOP): boolean {
  'worklet';
  return event.contentOffset.y + event.layoutMeasurement.height >= event.contentSize.height - slop;
}
