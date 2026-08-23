import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { a11yButton, haptics, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

/** (d) The canonical press affordance: scale to `scales.pressed` over `timings.press`. */
export function PressScaleDemo() {
  const { colors, spacing, radii, sizes, motion } = useTheme();
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);
  const scale = useSharedValue(1);

  const pressTiming = withReducedMotion(reduced, motion.timings.press);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...a11yButton('Press me')}
        onPressIn={() => {
          scale.set(withTiming(motion.scales.pressed, pressTiming));
        }}
        onPressOut={() => {
          scale.set(withTiming(1, pressTiming));
        }}
        onPress={() => {
          haptics.light();
          setCount((n) => n + 1);
        }}
        style={[
          styles.button,
          {
            height: sizes.buttonLg,
            borderRadius: radii.xl,
            backgroundColor: colors.surfaceInverse,
            paddingHorizontal: spacing[6],
          },
        ]}
      >
        <Text variant="bodySemiBold" color="surfacePage">
          Pressed {count} {count === 1 ? 'time' : 'times'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
});
