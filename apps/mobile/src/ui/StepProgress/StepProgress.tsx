import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

export type StepProgressProps = {
  /** 1-based current step. */
  step: number;
  total: number;
};

function Segment({ filled }: { filled: boolean }) {
  const { colors, motion, radii, u } = useTheme();
  const reduced = useReducedMotion();
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    const to = filled ? 1 : 0;
    fill.set(reduced ? to : withTiming(to, motion.timings.base));
  }, [fill, filled, motion.timings.base, reduced]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return (
    <View
      style={{
        flex: 1,
        height: u(4),
        borderRadius: radii.full,
        backgroundColor: colors.progressTrack,
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ height: '100%', backgroundColor: colors.brand }, fillStyle]} />
    </View>
  );
}

/** A thin segmented bar for multi-step flows (§172): one segment per step, filled to `step`. */
export function StepProgress({ step, total }: StepProgressProps) {
  const { u } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={{ flexDirection: 'row', gap: u(6) }}
    >
      {Array.from({ length: total }, (_, index) => (
        <Segment key={index} filled={index < step} />
      ))}
    </View>
  );
}
