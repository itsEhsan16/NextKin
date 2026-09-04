import { PixelRatio } from 'react-native';

import { ringRadius, strokeFitsCanvas } from '@/ui/Progress';

/**
 * The four flat sides.
 *
 * `ScoreRing` drew its arc at `(box - stroke) / 2`, which lands the stroke's outer edge exactly on
 * the SVG canvas boundary. The renderer clips there, so the antialiased outer half-pixel was shaved
 * off wherever the curve runs tangent to the edge — 12, 3, 6 and 9 o'clock — and the circle read as
 * flattened at those four points. It was reported from the 28dp card badge, where the shave is a
 * visible flat; on the 80dp Home ring the same absolute error is under a percent of the diameter
 * and only reads as slightly soft, which is why it went unnoticed for so long.
 */
describe('ringRadius — the arc never touches the canvas edge', () => {
  /** Every ring in the app, at the scales real phones produce. */
  const RINGS: readonly [name: string, box: number, stroke: number][] = [
    ['resume card badge, 411dp', 28.45, 2.77],
    ['resume card badge, 390dp', 27, 2.63],
    ['Home ATS ring, 411dp', 63.23, 3.16],
    ['Home ATS ring, 390dp', 60, 3],
    ['profile completeness ring', 82.2, 4],
    ['score panel ring, unscaled', 80, 4],
  ];

  const RATIOS = [2, 2.625, 2.75, 3, 3.5];

  const withRatio = (ratio: number, run: () => void) => {
    const get = jest.spyOn(PixelRatio, 'get').mockReturnValue(ratio);
    try {
      run();
    } finally {
      get.mockRestore();
    }
  };

  it.each(RINGS)('%s keeps its stroke inside the canvas at every pixel ratio', (_n, box, stroke) => {
    for (const ratio of RATIOS) {
      withRatio(ratio, () => {
        expect(strokeFitsCanvas(box, stroke)).toBe(true);
        // A whole physical pixel of clearance — enough for the antialiased fringe to land in.
        expect(box / 2 - (ringRadius(box, stroke) + stroke / 2)).toBeCloseTo(1 / ratio, 9);
      });
    }
  });

  it('would have caught the tangent form that shipped', () => {
    // State the wrong answer outright, so the test says what it defends against rather than only
    // what it wants. The old radius put the outer edge exactly on the bound: not outside it, which
    // is why no overflow check would have found this — exactly on it, which is where clipping bites.
    withRatio(2.75, () => {
      const [, box, stroke] = RINGS[0]!;
      const tangent = (box - stroke) / 2;
      expect(tangent + stroke / 2).toBeCloseTo(box / 2, 9);
      expect(ringRadius(box, stroke)).toBeLessThan(tangent);
    });
  });

  it('shrinks the drawn circle by less than a point', () => {
    // The fix has to be invisible as a size change, or it trades one artefact for another.
    withRatio(2.75, () => {
      for (const [, box, stroke] of RINGS) {
        const lost = (box - stroke) / 2 - ringRadius(box, stroke);
        expect(lost * 2).toBeLessThan(1);
      }
    });
  });

  it('never returns a negative radius for a stroke wider than the box', () => {
    withRatio(3, () => expect(ringRadius(4, 12)).toBe(0));
  });
});
