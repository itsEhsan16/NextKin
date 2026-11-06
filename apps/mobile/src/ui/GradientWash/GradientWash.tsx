import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

export type GradientWashProps = {
  /** How far down the screen the wash reaches, as a fraction. Defaults to 0.6. */
  depth?: number;
  /** A fixed height instead, for a long scrolling page whose wash covers only its top (§176). */
  height?: number;
};

/**
 * The redesign's hero backdrop (toreview.md §172): a soft lavender wash fading into the page,
 * with a faint brand glow in the top corner. Absolute, behind content, never interactive.
 */
export function GradientWash({ depth = 0.6, height }: GradientWashProps) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[styles.wash, { height: height ?? `${Math.round(depth * 100)}%` }]}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="washFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surfaceWash} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.surfacePage} stopOpacity="1" />
          </LinearGradient>
          <RadialGradient id="washGlow" cx="0.9" cy="0.05" r="0.75">
            <Stop offset="0" stopColor={colors.brand} stopOpacity="0.18" />
            <Stop offset="1" stopColor={colors.brand} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#washFade)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#washGlow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { position: 'absolute', top: 0, left: 0, right: 0 },
});
