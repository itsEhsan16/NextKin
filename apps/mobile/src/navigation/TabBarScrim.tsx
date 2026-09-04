import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTabBarLayout, useTheme } from '@/theme';

/**
 * How far up the pill the veil reaches, as a fraction of the pill's height.
 *
 * The scrim tops out *inside* the bar, not above it. Reaching past the pill veils whatever sits
 * over the chrome — on Home that is the shortcut grid, whose icons and counters wash out while
 * still in open space, which reads as a bug rather than as depth. Stopping short of the pill's
 * own top edge keeps the effect where the reference keeps it: the bar dissolves its own band, and
 * content above it is untouched until it scrolls into that band.
 */
const REACH = 0.8;

/**
 * Alpha the veil reaches at its strongest, at and below the pill.
 *
 * Deliberately short of 1: at full opacity content does not fade under the chrome so much as
 * vanish behind a second page, which is heavier than the reference. Leaving a little through
 * keeps the sense that there is more to scroll to without letting it compete with the pill.
 */
const PEAK = 0.85;

/**
 * Alpha down the ramp, sampled from `1 - smoothstep(t)` at seven even steps and scaled by `PEAK`.
 *
 * A straight two-stop ramp has a derivative discontinuity at each end, and the eye reads those as
 * two faint lines (Mach bands) instead of one soft edge. Easing out of the peak and into 0 is what
 * makes a ramp this short read as a fade at all.
 */
const FADE = [1, 0.926, 0.741, 0.5, 0.259, 0.074, 0].map((alpha) => alpha * PEAK);

/**
 * `#RRGGBB` → `rgba(r, g, b, a)`.
 *
 * The gradient needs a real alpha per stop, and the palette is opaque hex. Note the end stop must
 * be the page colour at alpha 0, *not* `'transparent'`: transparent is `rgba(0,0,0,0)`, so on the
 * unpremultiplied path the ramp would run through grey on the way out.
 */
function withAlpha(hex: string, alpha: number): string {
  if (hex.length !== 7 || !hex.startsWith('#')) return hex;
  const value = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(value)) return hex;
  return `rgba(${(value >> 16) & 0xff}, ${(value >> 8) & 0xff}, ${value & 0xff}, ${alpha})`;
}

const percent = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

/**
 * The band the floating pill sits in, painted in the page colour and dissolved at the top, so
 * content scrolling under the chrome fades out instead of sliding past it.
 *
 * Geometry comes from `useTabBarLayout()` so it cannot drift from the padding `Screen` reserves.
 * Flat at `PEAK` from the screen bottom up to the foot of the pill — that covers the strip below
 * the bar outright — then the whole of the rest is ramp, easing to nothing `REACH` of the way up
 * the pill. Almost all of the height is the fade, which is what makes it read as a gradual
 * thickening rather than a panel with a soft lip.
 *
 * One flat `View` with a native linear gradient in its background drawable: RN 0.86 ships CSS
 * gradients as `experimental_backgroundImage`, so this needs no `expo-linear-gradient`, no
 * offscreen pass and no per-frame JS. A real backdrop blur would need `expo-blur`, a
 * `BlurTargetView` wrapped around the tab tree, an Android 12 floor and a full-screen RenderNode
 * snapshot every scrolling frame; this gets the same read for none of that.
 *
 * Not on the artboards — Home Screen 210:262 is flat white from the shortcut grid to the frame
 * edge, and the pill carries only its upward drop shadow. The departure is deliberate, and it is
 * a no-op at rest: page colour over page colour, the same fill `Screen` already paints.
 *
 * `pointerEvents="none"` is load-bearing. This spans the full width, so without it every tap and
 * scroll landing beside the pill would die here.
 */
export function TabBarScrim() {
  const { colors } = useTheme();
  const layout = useTabBarLayout();

  // Opaque only below the bar; the ramp then runs the full height of the pill's own band.
  const plateau = layout.bottomOffset;
  const height = plateau + layout.pillHeight * REACH;

  const style = useMemo<ViewStyle>(() => {
    const start = plateau / height;
    const ramp = 1 - start;
    return {
      height,
      experimental_backgroundImage: [
        {
          type: 'linear-gradient',
          // Angle 0 — the first stop sits at the screen bottom.
          direction: 'to top',
          colorStops: [
            // The screen bottom, held flat at the peak up to the foot of the pill.
            { color: withAlpha(colors.surfacePage, PEAK), positions: ['0%'] },
            ...FADE.map((alpha, index) => ({
              color: withAlpha(colors.surfacePage, alpha),
              positions: [percent(start + (ramp * index) / (FADE.length - 1))],
            })),
          ],
        },
      ],
    };
  }, [colors.surfacePage, height, plateau]);

  return <View pointerEvents="none" style={[styles.scrim, style]} />;
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
