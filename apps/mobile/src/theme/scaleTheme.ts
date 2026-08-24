import { StyleSheet } from 'react-native';

import {
  buildShadows,
  radii,
  sizes,
  spacing,
  type ShadowStyle,
  type ShadowToken,
} from './tokens';
import { typography, type TypeRole, type TypographyRole } from './typography';

/**
 * Every token in `tokens.ts` and `typography.ts` is a Figma value measured on a 520px artboard.
 * These helpers project them onto the device: one factor, applied to everything, so a screen is
 * a true proportional replica of its frame rather than an approximation that reflows.
 *
 * Consumed once per (scheme, width) by `themeFor()` — never call these from a component.
 */

/** Scaled tokens are plain numbers; `as const` literals (`readonly 4: 16`) would not accept them. */
type Widen<T> = { -readonly [K in keyof T]: T[K] extends number ? number : T[K] };

export type Spacing = Widen<typeof spacing>;
export type Radii = Widen<typeof radii>;
export type Sizes = Widen<typeof sizes>;
export type Typography = Record<TypographyRole, TypeRole>;
export type Shadows = Record<ShadowToken, ShadowStyle>;

/**
 * Escape hatch for the type ramp alone. The artboards put body text at 15/520 = 2.9% of the
 * frame, which lands near 10.4dp on a 360dp phone — faithful, but small. Nudge this (1.08 is
 * about one step) to lift every text role without disturbing a single layout measurement.
 */
export const TYPE_SCALE_BIAS = 1;

/** `full` is a pill sentinel, not a length — scaling it would still round, just less obviously. */
const RADII_EXEMPT: readonly string[] = ['full'];

/**
 * `designWidth` is the divisor itself. `minHitTarget` is the platform ergonomic floor (44pt),
 * not artboard geometry — shrinking it would make tap targets worst on the smallest screens.
 */
const SIZES_EXEMPT: readonly string[] = ['designWidth', 'minHitTarget'];

function scaleRecord<T extends Record<string, number>>(
  record: T,
  scale: number,
  exempt: readonly string[],
): Widen<T> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = exempt.includes(key) ? value : value * scale;
  }
  return out as Widen<T>;
}

export const scaleSpacing = (scale: number): Spacing => scaleRecord(spacing, scale, []);
export const scaleRadii = (scale: number): Radii => scaleRecord(radii, scale, RADII_EXEMPT);
export function scaleSizes(scale: number): Sizes {
  const scaled = scaleRecord(sizes, scale, SIZES_EXEMPT);
  // Not a readability floor: a stroke that rounds to zero physical pixels disappears entirely.
  // It never binds on a real device — a scaled 1px stroke is already thicker than a hairline.
  scaled.border = Math.max(StyleSheet.hairlineWidth, scaled.border);
  scaled.borderThick = Math.max(StyleSheet.hairlineWidth, scaled.borderThick);
  return scaled;
}
export const scaleShadows = (scale: number): Shadows => buildShadows(scale);

export function scaleTypography(scale: number): Typography {
  const factor = scale * TYPE_SCALE_BIAS;
  const out: Record<string, TypeRole> = {};

  for (const [role, style] of Object.entries(typography)) {
    out[role] = {
      fontFamily: style.fontFamily,
      fontSize: (style.fontSize ?? 0) * factor,
      // Fractional line heights jitter baselines between consecutive lines on Android once
      // `includeFontPadding` is off. Round to a half-pixel — *up*, so `lineHeight >= fontSize`
      // survives the rounding.
      lineHeight: Math.ceil((style.lineHeight ?? 0) * factor * 2) / 2,
      letterSpacing: (style.letterSpacing ?? 0) * factor,
    };
  }

  return out as Typography;
}
