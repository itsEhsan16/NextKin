import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Text } from '@/ui/Text';

import { AnimatedNumber } from './AnimatedNumber';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ScoreRingProps = {
  /** 0–100 */
  score: number;
  /** Caption under the number ("ATS Score"). */
  label?: string;
  size?: number;
  strokeWidth?: number;
  ringColor?: ColorToken;
  trackColor?: ColorToken;
  labelColor?: ColorToken;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Circular score meter (Figma: 80px, 4px #4ade80 ring, "92" + "ATS Score"). The animation
 * lives on the score itself — not on a 0→1 mount envelope — so a rescore or refetch sweeps
 * from the old value to the new one instead of snapping. The same shared value feeds the arc
 * and the AnimatedNumber, so the count-up can never drift from the sweep; both stay on the
 * UI thread.
 */
export function ScoreRing({
  score,
  label,
  size = 80,
  strokeWidth = 4,
  ringColor = 'successRing',
  // The unfilled arc is a faint tint of the ring, not grey: Figma (1:169) draws an unbroken
  // green circle, and a grey remainder reads as a gap in it.
  trackColor = 'successSurface',
  labelColor = 'success',
  accessibilityLabel,
  style,
}: ScoreRingProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(100, score));
  const animatedScore = useSharedValue(0);

  useEffect(() => {
    animatedScore.set(withTiming(target, withReducedMotion(reduced, motion.timings.meter)));
  }, [animatedScore, motion.timings.meter, reduced, target]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedScore.value / 100),
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `${label ?? 'Score'} ${target}`}
      accessibilityValue={{ min: 0, max: 100, now: target }}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors[trackColor]}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors[ringColor]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={arcProps}
          // Start the sweep at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <AnimatedNumber value={animatedScore} variant="statRegular" />
      {label ? (
        <Text variant="tiny" color={labelColor} style={{ marginTop: -2 }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
