import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FULL_BPS,
  clampBps,
  compareCodePoints,
  divRoundHalfEven,
  ratioBps,
  weightedTotalBps,
} from '../src/bps';

describe('divRoundHalfEven', () => {
  it('rounds halves to the even neighbour', () => {
    expect(divRoundHalfEven(5, 2)).toBe(2);
    expect(divRoundHalfEven(7, 2)).toBe(4);
    expect(divRoundHalfEven(-5, 2)).toBe(-2);
    expect(divRoundHalfEven(10, 4)).toBe(2);
  });

  it('never differs from the exact quotient by more than half', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e9, max: 1e9 }), fc.integer({ min: 1, max: 1e6 }), (n, d) => {
        const rounded = divRoundHalfEven(n, d);
        expect(Math.abs(rounded * d - n) * 2).toBeLessThanOrEqual(d);
      }),
    );
  });

  it('rejects non-integers and non-positive denominators', () => {
    expect(() => divRoundHalfEven(1.5, 2)).toThrow(RangeError);
    expect(() => divRoundHalfEven(1, 0)).toThrow(RangeError);
  });
});

describe('ratioBps', () => {
  it('turns "x of y" into basis points', () => {
    expect(ratioBps(3, 8)).toBe(3750);
    expect(ratioBps(0, 5)).toBe(0);
    expect(ratioBps(5, 5)).toBe(FULL_BPS);
  });

  it('stays within [0, 100%] and is monotonic in the part', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), fc.nat(), (whole, seed) => {
        const part = seed % (whole + 1);
        const value = ratioBps(part, whole);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(FULL_BPS);
        if (part < whole) expect(ratioBps(part + 1, whole)).toBeGreaterThanOrEqual(value);
      }),
    );
  });
});

describe('weightedTotalBps', () => {
  // The spec §7.8 rubric weights: keywords 40, timeline 20, sections 15, formatting 15, achievements 10.
  const weights = [4000, 2000, 1500, 1500, 1000];

  it('gives 100% when every component is full and 0% when every component is empty', () => {
    expect(weightedTotalBps(weights.map((weightBps) => ({ weightBps, scoreBps: FULL_BPS })))).toBe(FULL_BPS);
    expect(weightedTotalBps(weights.map((weightBps) => ({ weightBps, scoreBps: 0 })))).toBe(0);
  });

  it('a zeroed timeline component costs exactly its weight', () => {
    const scores = [FULL_BPS, 0, FULL_BPS, FULL_BPS, FULL_BPS];
    const total = weightedTotalBps(weights.map((weightBps, i) => ({ weightBps, scoreBps: scores[i]! })));
    expect(total).toBe(8000);
  });

  it('is deterministic and never rises when one component drops', () => {
    const score = fc.integer({ min: 0, max: FULL_BPS });
    fc.assert(
      fc.property(fc.array(score, { minLength: 5, maxLength: 5 }), fc.nat({ max: 4 }), (scores, i) => {
        const components = weights.map((weightBps, k) => ({ weightBps, scoreBps: scores[k]! }));
        const total = weightedTotalBps(components);
        expect(weightedTotalBps(components)).toBe(total);
        const lowered = components.map((c, k) => (k === i ? { ...c, scoreBps: 0 } : c));
        expect(weightedTotalBps(lowered)).toBeLessThanOrEqual(total);
      }),
    );
  });

  it('refuses weights that do not sum to 100%', () => {
    expect(() => weightedTotalBps([{ weightBps: 5000, scoreBps: FULL_BPS }])).toThrow(/sum to 10000/);
  });
});

describe('clampBps and compareCodePoints', () => {
  it('clamps into range', () => {
    expect(clampBps(-5)).toBe(0);
    expect(clampBps(12_000)).toBe(FULL_BPS);
  });

  it('orders by code point, not locale', () => {
    expect(['Zeta', 'alpha', 'Äpfel'].sort(compareCodePoints)).toEqual(['Zeta', 'alpha', 'Äpfel']);
  });
});
