import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * The auth landing's primary button fill (Figma 296:3038) — a left-to-right purple wash.
 *
 * An absolute fill behind the label rather than a background colour, for the same reason as
 * `AuthGradient`: react-native-svg is already a dependency and expo-linear-gradient is not.
 */
export function GradientPill({ from, to }: { from: string; to: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="authPill" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#authPill)" />
    </Svg>
  );
}
