import { StyleSheet } from 'react-native';

import {
  buildArtboardShadows,
  buildShadows,
  radii,
  sizes,
  spacing,
  type ShadowStyle,
  type ShadowToken,
} from './tokens';
import { typography, type TypeRole, type TypographyRole } from './typography';

/**
 * Every token in `tokens.ts` is a Figma value measured on the 520px artboard. These helpers
 * project them onto the device by one factor, applied to everything, so a screen is a true
 * proportional replica of its frame rather than an approximation that reflows. The Figma
 * "Mobile 2" page confirms that policy for geometry: at 390 it is the 520 page at exactly 0.75,
 * node for node, which is what `scale` already computes on a 390dp phone.
 *
 * Type is the one exception, and it is the designers' exception, not ours — see `typographyFor`.
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
export const scaleArtboardShadows = (scale: number): Shadows => buildArtboardShadows(scale);

/** The narrow artboard — the Figma "Mobile 2" page. */
export const NARROW_WIDTH = 390;

/**
 * Reads a measurement between the two artboards.
 *
 * Above 390 it interpolates towards the 520 board. Below 390 it stops: that artboard is already
 * a phone width, not a midpoint between two, so it is the floor. Boxes keep scaling under it —
 * a 360dp screen still gets the layout at ×0.923 — but the type stays exactly as drawn, which is
 * the only way it stays legible there without inventing sizes the boards never had.
 */
function between(a390: number, a520: number, width: number, cellBound = false): number {
  // A cell-bound role keeps tracking its box below the narrow board; see `cellRole`.
  if (width <= NARROW_WIDTH) return cellBound ? (a390 * width) / NARROW_WIDTH : a390;
  const frame = Math.min(sizes.designWidth, width);
  return a390 + ((a520 - a390) * (frame - NARROW_WIDTH)) / (sizes.designWidth - NARROW_WIDTH);
}

/**
 * The type ramp at a given frame width.
 *
 * Unlike every other token, type does not come off a single factor: the design team drew the
 * 390 board with the layout scaled by 0.75 and the font sizes deliberately held back, so text
 * stays legible in boxes that shrank. Each role carries both measurements (see typography.ts)
 * and this reads between them. Leading and tracking are part of that measurement, so they land
 * on the artboard value at each anchor without any separate factor.
 */
export function typographyFor(width: number): Typography {
  const out: Record<string, TypeRole> = {};

  for (const [role, anchors] of Object.entries(typography)) {
    out[role] = {
      fontFamily: anchors.fontFamily,
      fontSize: between(anchors.at390.fontSize, anchors.at520.fontSize, width, anchors.cellBound),
      // Fractional line heights jitter baselines between consecutive lines on Android once
      // `includeFontPadding` is off. Round to a half-pixel — *up*, so `lineHeight >= fontSize`
      // survives the rounding.
      lineHeight:
        Math.ceil(
          between(anchors.at390.lineHeight, anchors.at520.lineHeight, width, anchors.cellBound) * 2,
        ) / 2,
      letterSpacing: between(
        anchors.at390.letterSpacing,
        anchors.at520.letterSpacing,
        width,
        anchors.cellBound,
      ),
    };
  }

  return out as Typography;
}
