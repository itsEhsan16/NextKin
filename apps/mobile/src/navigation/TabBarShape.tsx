import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * The nav bar's background, from Figma 429:7519 — a 299 × 61.4004 pill with a wide, shallow scoop
 * taken out of its top edge for the FAB to sit in, and the soft shadow the board drops under it.
 *
 * Written as a component rather than committed as an `.svg` like every other vector in this app,
 * which is a deliberate exception: `react-native-svg-transformer` runs the file through SVGR,
 * and SVGR's native preset *drops* `<filter>` on the way through — it prints "has dropped some
 * elements not supported by react-native-svg: filter" and emits the path alone. The shadow would
 * have gone missing silently, and it is not decoration here: the bar is white, the page behind it
 * is near-white, and the shadow is the only thing that separates them. `react-native-svg` itself
 * renders the filter at runtime; only the build-time conversion cannot express it.
 *
 * It is a shape and not a `View` because the scoop is concave. No border radius describes it, and
 * neither `boxShadow` nor `elevation` would follow it — both trace the rectangle the view
 * occupies, which would lay a straight edge across the dip.
 *
 * `BOX` is larger than the bar on every side: a drop shadow is clipped to the filter region, so
 * the blur needs `BLEED` to spread into, and the shape is pushed back by that much so the pill's
 * own box still measures the bar. The whole thing scales on width alone — `tabBarHeight` and the
 * pill-width ratio both carry `NAV_BOOST`, so 61.4004/299 holds at every screen size.
 */
const PILL = 299;
const BOX = { width: 332, height: 94.4004, bleed: 15.5 };

/** The bar as drawn, in the bleed box's coordinates. */
const OUTLINE =
  'M283.8 15.5C300.755 15.5 314.5 29.245 314.5 46.2002C314.5 63.1553 300.755 76.9004 283.8 ' +
  '76.9004H46.2002C29.2451 76.9004 15.5001 63.1553 15.5 46.2002C15.5 29.245 29.245 15.5 46.2002 ' +
  '15.5H105.5C122.621 15.5 136.667 32.8794 151.974 40.5488C155.743 42.4372 159.997 43.5 164.5 ' +
  '43.5C169.003 43.5 173.257 42.4372 177.026 40.5488C192.333 32.8794 206.379 15.5 223.5 ' +
  '15.5H283.8Z';

/**
 * The board's shadow (429:7587: offset 1 / 1, σ 6.825, black at 40%) as 24 bands of
 * [reach, alpha]. Each band strokes the outline to `reach` on either side; where bands overlap their
 * alphas add, so the alpha at a distance d outside the edge is the sum of the bands that reach past
 * d. Each band's alpha is the drop in a Gaussian edge profile, 0.4 × ½erfc(d / σ√2), between its
 * inner and outer reach, so the stack traces that profile: 20% at the edge, ~0.4% at the
 * 2.5σ = 17 the SVG has room for. Generated, not hand-tuned.
 */
const SHADOW_BANDS: readonly (readonly [number, number])[] = [
  [0.711, 0.01659],
  [1.422, 0.01641],
  [2.133, 0.01606],
  [2.844, 0.01555],
  [3.555, 0.01489],
  [4.266, 0.0141],
  [4.977, 0.01321],
  [5.688, 0.01225],
  [6.398, 0.01123],
  [7.109, 0.01019],
  [7.82, 0.00914],
  [8.531, 0.00811],
  [9.242, 0.00712],
  [9.953, 0.00619],
  [10.664, 0.00532],
  [11.375, 0.00452],
  [12.086, 0.0038],
  [12.797, 0.00316],
  [13.508, 0.0026],
  [14.219, 0.00212],
  [14.93, 0.0017],
  [15.641, 0.00136],
  [16.352, 0.00107],
  [17.062, 0.00083],
];

export type TabBarShapeProps = {
  /** Width of the bar itself, which everything else is scaled from. */
  pillWidth: number;
  /** The bar's fill; the shadow under it stays the board's black either way. */
  color: string;
};

/**
 * Memoised: the bar re-renders on every navigation (it reads the route segments), and this is the
 * heaviest thing in it — the outline stroked two dozen times. Both props are primitives.
 */
export const TabBarShape = memo(function TabBarShape({ pillWidth, color }: TabBarShapeProps) {
  const { colors } = useTheme();
  const k = pillWidth / PILL;

  return (
    <Svg
      width={BOX.width * k}
      height={BOX.height * k}
      viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      color={color}
      pointerEvents="none"
      style={[styles.shape, { left: -BOX.bleed * k, top: -BOX.bleed * k }]}
    >
      {/*
        The board's shadow — offset 1 / 1, blur 13.65 (σ 6.825), black at 40% (429:7587) — drawn
        as the outline stroked at widening radii, each band faint (see SHADOW_BANDS). Not a <Filter>: on a device the
        filtered path rendered squashed (the bar ~70% of its height, the scoop flattened), and
        stacked strokes draw the same on every platform.
      */}
      <G transform="translate(1 1)">
        {SHADOW_BANDS.map(([reach, alpha]) => (
          <Path
            key={reach}
            d={OUTLINE}
            fill="none"
            stroke={colors.shadowInk}
            strokeOpacity={alpha}
            strokeWidth={reach * 2}
            strokeLinejoin="round"
          />
        ))}
      </G>
      <Path d={OUTLINE} fill="currentColor" />
    </Svg>
  );
});

const styles = StyleSheet.create({
  shape: { position: 'absolute' },
});
