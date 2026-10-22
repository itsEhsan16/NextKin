import Svg, {
  Circle,
  Defs,
  FeDropShadow,
  FeGaussianBlur,
  Filter,
  G,
  Path,
  Rect,
} from 'react-native-svg';

import { useTheme } from '@/theme';

export type MatchIllustrationProps = { width: number; height: number };

/**
 * The small "résumé being checked" drawing on the right of "Why you match" (Figma 443:120).
 *
 * A component rather than an `.svg` for the reason `TabBarShape` gives: SVGR drops `<filter>`,
 * and this drawing has two that matter — the lavender blob is a blurred disc, not a hard-edged
 * one, and the page floats on a soft brand shadow. Coordinates are the board's own export box
 * (93 × 102 drawn, the 84 × 96 frame plus the room its blur and shadow spread into), and every
 * colour is a theme token rather than the hex the export carried.
 */
const BOX = { width: 93, height: 102 };

/** The page's skeleton lines: [x, y, width], all rotated 5° about their own corner. */
const LINES: readonly (readonly [number, number, number])[] = [
  [24.585, 23.6631, 22],
  [24.062, 29.6401, 32],
  [23.5393, 35.6174, 26],
  [23.0164, 41.5945, 14],
  [22.4934, 47.5718, 30],
  [21.9705, 53.5488, 24],
  [21.4475, 59.5261, 30],
  [20.9246, 65.5032, 12],
];

/** The three short strokes above the page's corner: [x, y, angle]. */
const SPARKS: readonly (readonly [number, number, number])[] = [
  [60.4766, 7.198, -5.12749],
  [67.0376, 8, 22.1368],
  [67.9546, 17.8633, -106.104],
];

const TICK =
  'M23.0989 37.4938L22.0719 36.2277C22.01 36.1515 22.0222 36.034 22.0985 35.9722L22.3731 ' +
  '35.7494C22.4493 35.6876 22.5598 35.6991 22.6217 35.7753L23.3216 36.6303L25.152 35.1453C25.2283 ' +
  '35.0835 25.3388 35.095 25.4007 35.1713L25.6234 35.4458C25.6853 35.5221 25.6731 35.6395 25.5968 ' +
  '35.7014L23.3545 37.5204C23.2782 37.5823 23.1608 37.5701 23.0989 37.4938Z';

const CROSS =
  'M21.9291 45.2696C23.4872 45.4301 24.6195 46.8225 24.459 48.3805C24.2986 49.9385 22.9062 ' +
  '51.0709 21.3482 50.9104C19.7901 50.7499 18.6578 49.3576 18.8183 47.7995C18.9787 46.2415 ' +
  '20.3711 45.1092 21.9291 45.2696ZM22.9374 48.9823L22.2755 48.1556L23.0909 47.4925C23.1524 ' +
  '47.4529 23.1618 47.3619 23.1108 47.2992L22.7129 46.81C22.6619 46.7473 22.5709 46.7379 22.5196 ' +
  '46.7901L21.7042 47.4532L21.0412 46.6378C20.9902 46.5751 20.8992 46.5657 20.8478 46.6179L20.3472 ' +
  '47.0146C20.2845 47.0656 20.2752 47.1566 20.3273 47.2079L21.0018 48.0244L20.1751 48.6863C20.1123 ' +
  '48.7373 20.103 48.8283 20.1552 48.8797L20.5518 49.3802C20.6028 49.443 20.6938 49.4523 20.7452 ' +
  '49.4002L21.5731 48.7269L22.235 49.5536C22.2746 49.6151 22.3656 49.6245 22.4283 49.5735L22.9175 ' +
  '49.1757C22.9802 49.1247 22.9896 49.0337 22.9374 48.9823Z';

export function MatchIllustration({ width, height }: MatchIllustrationProps) {
  const { colors } = useTheme();

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      // Pure decoration: the criteria beside it already say everything it shows.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Defs>
        <Filter id="blob" x="0" y="8.6" width="92.8" height="92.8" filterUnits="userSpaceOnUse">
          <FeGaussianBlur stdDeviation="3.7" />
        </Filter>
        <Filter id="page" x="2" y="8" width="73.2" height="85.95" filterUnits="userSpaceOnUse">
          <FeDropShadow
            dx="0"
            dy="4"
            stdDeviation="5"
            floodColor={colors.brand}
            floodOpacity="0.12"
          />
        </Filter>
      </Defs>

      <Circle cx="46.4" cy="55" r="39" fill={colors.brandSurface} filter="url(#blob)" />

      <G filter="url(#page)">
        <Rect
          x="17.4"
          y="14"
          width="48"
          height="62"
          rx="7"
          transform="rotate(5 17.4 14)"
          fill={colors.surfaceCard}
        />
        <Rect
          x="17.7408"
          y="14.4063"
          width="47.25"
          height="61.25"
          rx="6.625"
          transform="rotate(5 17.7408 14.4063)"
          stroke={colors.borderDefault}
          strokeWidth="0.75"
          fill="none"
        />
        {LINES.map(([x, y, w], index) => (
          <Rect
            key={index}
            x={x}
            y={y}
            width={w}
            height="2.2"
            rx="1.1"
            transform={`rotate(5 ${x} ${y})`}
            // The first line is the page's heading, drawn dark; the rest are body text.
            fill={index === 0 ? colors.textBody : colors.borderDefault}
          />
        ))}
        <Circle
          cx="23.7931"
          cy="36.3931"
          r="3.66667"
          fill={colors.success}
          stroke={colors.surfaceCard}
          strokeWidth="0.666667"
        />
        <Path d={TICK} fill={colors.surfaceCard} />
      </G>

      {SPARKS.map(([x, y, angle], index) => (
        <Rect
          key={index}
          x={x}
          y={y}
          width="2"
          height="7"
          rx="1"
          transform={`rotate(${angle} ${x} ${y})`}
          fill={colors.brand}
        />
      ))}

      <Path d={CROSS} fill={colors.danger} />
    </Svg>
  );
}
