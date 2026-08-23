import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

/**
 * Motion tokens — derived from the Figma annotation notes:
 *  "sheet springs in (damping ≈ 0.8, slight overshoot, ~300ms); the nav + rotates 45° to ✕ in sync;
 *   rows stagger in 50–100ms apart; light haptic on open. Scrim tap or ✕ dismisses (exit faster, ~200ms)."
 * Every animated component must use these instead of inline numbers.
 */
export const durations = {
  instant: 0,
  press: 120,
  fast: 180,
  sheetOut: 200,
  base: 220,
  snappy: 250,
  sheetIn: 300,
  accordion: 260,
  slow: 400,
  /** Cross-fade for images decoding in (expo-image transition). */
  imageFade: 150,
  /** One half-cycle of the skeleton pulse. */
  pulse: 900,
  meter: 800,
} as const;

export const easings = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  decelerate: Easing.out(Easing.cubic),
  accelerate: Easing.in(Easing.cubic),
  linear: Easing.linear,
} as const;

export const springs = {
  /** Sheet entry: slight overshoot, ~300ms. */
  sheetIn: { duration: durations.sheetIn, dampingRatio: 0.8 } satisfies WithSpringConfig,
  /** Critically damped, quick — segmented pill, toggle thumbs. */
  snappy: { duration: durations.snappy, dampingRatio: 1 } satisfies WithSpringConfig,
  /** Gentle settle for layout transitions and chips. */
  gentle: { duration: 350, dampingRatio: 0.9 } satisfies WithSpringConfig,
  /** Bouncy micro-interactions (bookmark fill, badge pop). */
  bouncy: { duration: 320, dampingRatio: 0.6 } satisfies WithSpringConfig,
} as const;

export const timings = {
  press: { duration: durations.press, easing: easings.standard } satisfies WithTimingConfig,
  fast: { duration: durations.fast, easing: easings.standard } satisfies WithTimingConfig,
  sheetOut: { duration: durations.sheetOut, easing: easings.decelerate } satisfies WithTimingConfig,
  base: { duration: durations.base, easing: easings.standard } satisfies WithTimingConfig,
  accordion: { duration: durations.accordion, easing: easings.standard } satisfies WithTimingConfig,
  meter: { duration: durations.meter, easing: easings.decelerate } satisfies WithTimingConfig,
  tabSwitch: { duration: durations.fast, easing: easings.standard } satisfies WithTimingConfig,
} as const;

export const stagger = {
  /** Delay between consecutive rows entering (sheet rows, criteria rows). */
  row: 60,
  /** Delay between cards in a grid/list first paint. */
  card: 40,
  /** Max number of items that get a staggered entrance; the rest appear immediately. */
  maxItems: 8,
} as const;

export const scales = {
  pressed: 0.97,
  pressedSubtle: 0.985,
  exit: 0.9,
  fabPressed: 0.92,
} as const;

export const sheet = {
  fabRotationOpenDeg: 45,
  swipeDismissVelocity: 800,
  swipeDismissFraction: 0.35,
} as const;

export const motion = { durations, easings, springs, timings, stagger, scales, sheet } as const;
