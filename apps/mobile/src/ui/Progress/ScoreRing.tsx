import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme, type ColorToken, type TypographyRole } from '@/theme';
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
  /** Type role of the count-up digits — the 44px card badge sets 13 Bold, the hero 42 Bold. */
  numberVariant?: TypographyRole;
  numberColor?: ColorToken;
  labelVariant?: TypographyRole;
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
/** Artboard sizes; callers pass device-space values, so the defaults are scaled to match. */
const DEFAULT_SIZE = 80;
const DEFAULT_STROKE = 4;

export function ScoreRing({
  score,
  label,
  size,
  strokeWidth,
  ringColor = 'successRing',
  // The unfilled arc is a faint tint of the ring, not grey: Figma (1:169) draws an unbroken
  // green circle, and a grey remainder reads as a gap in it.
  trackColor = 'successSurface',
  labelColor = 'success',
  numberVariant = 'statRegular',
  numberColor = 'textBlack',
  labelVariant = 'tiny',
  accessibilityLabel,
  style,
}: ScoreRingProps) {
  const { colors, motion, s } = useTheme();
  const box = size ?? s(DEFAULT_SIZE);
  const stroke = strokeWidth ?? s(DEFAULT_STROKE);
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(100, score));
  const animatedScore = useSharedValue(0);

  useEffect(() => {
    animatedScore.set(withTiming(target, withReducedMotion(reduced, motion.timings.meter)));
  }, [animatedScore, motion.timings.meter, reduced, target]);

  const radius = (box - stroke) / 2;
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
      style={[{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Svg width={box} height={box} style={{ position: 'absolute' }}>
        <Circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          stroke={colors[trackColor]}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          stroke={colors[ringColor]}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={arcProps}
          // Start the sweep at 12 o'clock.
          transform={`rotate(-90 ${box / 2} ${box / 2})`}
        />
      </Svg>
      <AnimatedNumber value={animatedScore} variant={numberVariant} color={numberColor} />
      {label ? (
        <Text variant={labelVariant} color={labelColor} style={{ marginTop: -s(2) }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
