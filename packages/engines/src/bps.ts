/**
 * Integer basis-point arithmetic. Every weight, score and percentage an engine produces is an
 * integer number of basis points (1 bp = 0.01%, so 10_000 bp = 100%). Floats are avoided because
 * the same rubric must give byte-identical results on Hermes, V8 and months later (G12, G15).
 */

/** 100% in basis points. */
export const FULL_BPS = 10_000;

export type Bps = number;

function assertInt(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer, got ${value}`);
  }
}

/** Clamps a value into [0, FULL_BPS]. */
export function clampBps(value: Bps): Bps {
  assertInt(value, 'value');
  return Math.min(FULL_BPS, Math.max(0, value));
}

/**
 * Integer division rounded half to even (banker's rounding). Half-even avoids the upward drift
 * half-up rounding gives when many components are summed.
 */
export function divRoundHalfEven(numerator: number, denominator: number): number {
  assertInt(numerator, 'numerator');
  assertInt(denominator, 'denominator');
  if (denominator <= 0) throw new RangeError('denominator must be positive');
  const sign = numerator < 0 ? -1 : 1;
  const n = Math.abs(numerator);
  const quotient = Math.floor(n / denominator);
  const twiceRemainder = 2 * (n - quotient * denominator);
  let rounded = quotient;
  if (twiceRemainder > denominator || (twiceRemainder === denominator && quotient % 2 === 1)) {
    rounded = quotient + 1;
  }
  return sign * rounded;
}

/** `part` of `whole` in basis points, e.g. 3 of 8 required skills → 3750. */
export function ratioBps(part: number, whole: number): Bps {
  assertInt(part, 'part');
  assertInt(whole, 'whole');
  if (whole <= 0) throw new RangeError('whole must be positive');
  if (part < 0 || part > whole) throw new RangeError('part must be within [0, whole]');
  return divRoundHalfEven(part * FULL_BPS, whole);
}

export interface WeightedComponent {
  /** The component's weight, in basis points. All weights together must sum to FULL_BPS. */
  weightBps: Bps;
  /** The component's own score, in basis points of that component. */
  scoreBps: Bps;
}

/**
 * The weighted total of components, in basis points. Throws unless the weights sum to exactly
 * 100%: a rubric whose weights drift is a method change and must be versioned, never absorbed.
 */
export function weightedTotalBps(components: readonly WeightedComponent[]): Bps {
  let weightSum = 0;
  let accumulator = 0;
  for (const { weightBps, scoreBps } of components) {
    assertInt(weightBps, 'weightBps');
    assertInt(scoreBps, 'scoreBps');
    if (weightBps < 0) throw new RangeError('weights must not be negative');
    if (scoreBps < 0 || scoreBps > FULL_BPS) throw new RangeError('scores must be within [0, 100%]');
    weightSum += weightBps;
    accumulator += weightBps * scoreBps;
  }
  if (weightSum !== FULL_BPS) {
    throw new RangeError(`weights must sum to ${FULL_BPS}, got ${weightSum}`);
  }
  return divRoundHalfEven(accumulator, FULL_BPS);
}

/** Orders strings by Unicode code point, independent of the runtime's locale data. */
export function compareCodePoints(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
