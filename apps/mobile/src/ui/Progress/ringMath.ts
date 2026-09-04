import { PixelRatio } from 'react-native';

/**
 * Pure geometry for `ScoreRing`, kept out of the component so the arithmetic below is testable
 * without mounting SVG — the same reason `rangeMath` and `swipeMath` exist.
 */

/**
 * Radius of the arc drawn inside a `box`-square SVG canvas with a `stroke`-wide ring.
 *
 * The obvious `(box - stroke) / 2` is off by a hair, and it shipped. An SVG stroke straddles its
 * path, so that radius puts the stroke's outer edge at exactly `box / 2` — precisely the canvas
 * boundary. Exact is not safe here: the renderer clips at that boundary, so the outer half-pixel
 * of the antialiased edge is shaved away wherever the curve runs tangent to it, which is at 12, 3,
 * 6 and 9 o'clock. The circle comes out visibly flattened at those four points.
 *
 * It scales with how large the ring is relative to a pixel: on the 80dp Home ring the shave is
 * under a percent of the diameter and reads as slightly soft, but on the 28dp card badge it is a
 * flat side. That is why it was reported from the badge and never from the ring.
 *
 * So pull the radius in by a whole physical pixel and give the fringe somewhere to land. The ring
 * loses ~0.7dp of diameter at PixelRatio 2.75 — below the threshold of a visible size change, and
 * the four flats go away.
 */
export function ringRadius(box: number, stroke: number): number {
  return Math.max(0, (box - stroke) / 2 - 1 / PixelRatio.get());
}

/**
 * Whether the stroke drawn at `ringRadius` stays strictly inside the canvas.
 *
 * The invariant the fix exists to hold, stated once so the test and the doc cannot drift apart.
 */
export function strokeFitsCanvas(box: number, stroke: number): boolean {
  return ringRadius(box, stroke) + stroke / 2 < box / 2;
}
