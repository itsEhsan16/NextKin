import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';

import { LINE_ICON_PATHS } from './lineIcons.generated';

export type LineIconName = keyof typeof LINE_ICON_PATHS;

/** The ramp in `sizes` (`iconXs`…`iconLg`); a number is a device-space box for the rare odd one. */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | number;

export type IconProps = {
  name: LineIconName;
  /** Box size. Defaults to `sm`, the size beside body text. */
  size?: IconSize;
  /** A resolved colour (`colors.textMuted`), as the call sites already hold one. */
  color: string;
  /** Untitled UI draws every glyph at 2 on its 24 grid; the tab bar thickens the active one. */
  strokeWidth?: number;
  /** Paints the glyph's closed shape too — a saved bookmark against an unsaved outline. */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The box that draws a line glyph as large as a filled glyph of `glyph` was drawn. Untitled UI
 * leaves a margin inside its 24 grid; a FontAwesome glyph filled its size. For the few sizes still
 * derived from a caller rather than taken off the ramp.
 */
export const lineBox = (glyph: number): number => glyph / 0.8;

/**
 * How much of the 24 grid a compact glyph spans, for sizing a box from a board's drawn glyph
 * length: `length / glyphSpan.arrow` draws an arrow exactly as long as the board's.
 */
export const glyphSpan = { chevron: 12 / 24, arrow: 14 / 24 } as const;

const BOX_KEY = { xs: 'iconXs', sm: 'iconSm', md: 'iconMd', lg: 'iconLg' } as const;

/**
 * One Untitled UI line icon — the set `apps/web` draws through `src/ui/lineIcons.ts`, redrawn with
 * react-native-svg because the npm package renders DOM `<svg>`. Decorative by default: the
 * control around it carries the accessible label.
 */
export const Icon = memo(function Icon({
  name,
  size = 'sm',
  color,
  strokeWidth = 2,
  filled = false,
  style,
}: IconProps) {
  const { sizes } = useTheme();
  const box = typeof size === 'number' ? size : sizes[BOX_KEY[size]];
  return (
    <Svg
      width={box}
      height={box}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {LINE_ICON_PATHS[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          fill={filled ? color : 'none'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
});
