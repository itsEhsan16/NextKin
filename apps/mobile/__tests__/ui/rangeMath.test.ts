import { clampHigh, clampLow, fractionOf, pxToValue, quantise } from '@/ui/RangeSlider';

/** The salary slider's real scale: ₹0–₹80L in ₹1L notches, thumbs kept ₹5L apart. */
const MIN = 0;
const MAX = 8_000_000;
const STEP = 100_000;
const GAP = 500_000;

describe('rangeMath (JOBS 04 salary slider)', () => {
  describe('quantise', () => {
    it('snaps to the nearest notch', () => {
      expect(quantise(2_040_000, MIN, MAX, STEP)).toBe(2_000_000);
      expect(quantise(2_060_000, MIN, MAX, STEP)).toBe(2_100_000);
    });

    it('clamps outside the scale', () => {
      expect(quantise(-500_000, MIN, MAX, STEP)).toBe(MIN);
      expect(quantise(99_000_000, MIN, MAX, STEP)).toBe(MAX);
    });

    it('degrades to a plain clamp when the step is meaningless', () => {
      expect(quantise(1_234_567, MIN, MAX, 0)).toBe(1_234_567);
    });
  });

  describe('fractionOf', () => {
    it('maps a value onto 0–1 across the scale', () => {
      expect(fractionOf(MIN, MIN, MAX)).toBe(0);
      expect(fractionOf(MAX, MIN, MAX)).toBe(1);
      expect(fractionOf(2_000_000, MIN, MAX)).toBeCloseTo(0.25);
    });

    it('returns 0 for a degenerate scale rather than dividing by zero', () => {
      expect(fractionOf(5, 10, 10)).toBe(0);
    });
  });

  describe('pxToValue', () => {
    it('converts a thumb offset back to a stepped value', () => {
      expect(pxToValue(0, MIN, MAX, 400, STEP)).toBe(MIN);
      expect(pxToValue(400, MIN, MAX, 400, STEP)).toBe(MAX);
      expect(pxToValue(200, MIN, MAX, 400, STEP)).toBe(4_000_000);
    });

    it('survives the first render, before the track has been measured', () => {
      expect(pxToValue(120, MIN, MAX, 0, STEP)).toBe(MIN);
    });
  });

  describe('thumb collision', () => {
    it('stops the low thumb a minimum gap below the high one, never swapping', () => {
      expect(clampLow(7_000_000, MIN, 4_500_000, GAP)).toBe(4_000_000);
      expect(clampLow(1_000_000, MIN, 4_500_000, GAP)).toBe(1_000_000);
    });

    it('stops the high thumb a minimum gap above the low one', () => {
      expect(clampHigh(1_000_000, 2_000_000, MAX, GAP)).toBe(2_500_000);
      expect(clampHigh(6_000_000, 2_000_000, MAX, GAP)).toBe(6_000_000);
    });

    it('clamps to the scale ends before honouring the gap', () => {
      expect(clampLow(-1, MIN, 200_000, GAP)).toBe(MIN);
      expect(clampHigh(99_000_000, 2_000_000, MAX, GAP)).toBe(MAX);
    });
  });
});
