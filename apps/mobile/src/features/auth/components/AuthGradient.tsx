import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * The welcome screen's brand wash (Figma 307:4153), as an absolute fill behind its content.
 *
 * Drawn as `linear-gradient(125.43deg, ...)`. The endpoints below are that angle resolved
 * against the artboard's own 414.67x895 box and expressed as fractions, which is what keeps the
 * three stops landing where they were drawn; a plain corner-to-corner gradient puts the mid stop
 * visibly high. Painted with react-native-svg rather than expo-linear-gradient — the dependency
 * is already here, and hard rule 1 says not to add one without a reason.
 */
export function AuthGradient() {
  const { colors } = useTheme();

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="authWash" x1="-0.342" y1="0.222" x2="1.342" y2="0.778">
          <Stop offset="0" stopColor={colors.onboardingGradientFrom} />
          <Stop offset="0.66346" stopColor={colors.onboardingGradientMid} />
          <Stop offset="1" stopColor={colors.onboardingGradientTo} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#authWash)" />
    </Svg>
  );
}
