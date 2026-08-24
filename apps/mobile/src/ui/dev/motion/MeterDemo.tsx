import { TextInput, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { DevButton } from '@/ui/dev/DevButton';
import { Text } from '@/ui/Text';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const TARGET = 0.72;
const BAR_HEIGHT = 10;

/**
 * (f) Match meter: width tweens with `timings.meter` while the label counts up on the UI
 * thread via `useAnimatedProps` on a non-editable TextInput (no per-frame React renders).
 */
export function MeterDemo() {
  const { colors, spacing, radii, typography, motion } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  const play = () => {
    progress.value = 0;
    progress.value = withTiming(TARGET, withReducedMotion(reduced, motion.timings.meter));
  };

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const labelProps = useAnimatedProps(() => {
    const text = `${Math.round(progress.value * 100)}%`;
    return { text, defaultValue: text };
  });

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={styles.header}>
        <Text variant="title">Match score</Text>
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          defaultValue="0%"
          animatedProps={labelProps}
          style={[styles.label, typography.stat, { color: colors.brand }]}
        />
      </View>
      <View
        style={{
          height: BAR_HEIGHT,
          borderRadius: radii.full,
          backgroundColor: colors.surfaceSubtle,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            styles.fill,
            { borderRadius: radii.full, backgroundColor: colors.brand },
            barStyle,
          ]}
        />
      </View>
      <DevButton label="Animate to 72%" onPress={play} active />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { padding: 0, textAlign: 'right', minWidth: s(56) },
  fill: { height: '100%' },
}));
