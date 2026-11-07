import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { a11yButton, useReducedMotion } from '@/lib';
import { motion, useTheme } from '@/theme';
import { Icon, glyphSpan } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Spinner } from '@/ui/motion';

export type AuthCtaProps = {
  label: string;
  onPress: () => void;
  /** The request is in flight: the arrow becomes the app's ring and further taps are ignored. */
  loading?: boolean;
  /** The pill's height, already scaled — sign-in and sign-up draw it differently. */
  height: number;
  /** The drawn arrow's length, already scaled. */
  arrow: number;
  /** The arrow's inset from the pill's right edge, already scaled. */
  arrowRight: number;
  style?: StyleProp<ViewStyle>;
};

const swapIn = FadeIn.duration(motion.durations.fast);
const swapOut = FadeOut.duration(motion.durations.fast);

/**
 * The full-width primary pill at the foot of sign-in (309:294) and sign-up (307:4395): label
 * centred, arrow pinned to the right edge. While the request runs the arrow cross-fades into the
 * app's ring and the pill stops taking taps — before this, a tap on Sign In showed nothing at all
 * until the answer came back.
 */
export function AuthCta({
  label,
  onPress,
  loading = false,
  height,
  arrow,
  arrowRight,
  style,
}: AuthCtaProps) {
  const { colors, radii } = useTheme();
  const reduced = useReducedMotion();
  // The board gives the arrow's own drawn length; the line arrow leaves a margin in its box.
  const box = arrow / glyphSpan.arrow;

  return (
    <Pressable
      {...a11yButton(label)}
      accessibilityState={{ busy: loading, disabled: loading }}
      feedback="scale"
      pressDim
      disabled={loading}
      dimDisabled={false}
      onPress={onPress}
      style={[
        styles.pill,
        // The redesign's ink pill (§181), as every other primary button.
        { height, borderRadius: radii.full, backgroundColor: colors.ink },
        style,
      ]}
    >
      <Text variant="buttonLabel" color="textOnDark">
        {label}
      </Text>
      <View style={[styles.trail, { right: arrowRight, width: box, height: box }]}>
        {loading ? (
          <Animated.View
            key="busy"
            entering={reduced ? undefined : swapIn}
            exiting={reduced ? undefined : swapOut}
          >
            <Spinner size={arrow} color="textOnDark" />
          </Animated.View>
        ) : (
          <Animated.View
            key="idle"
            entering={reduced ? undefined : swapIn}
            exiting={reduced ? undefined : swapOut}
          >
            <Icon name="ArrowRight" size={box} color={colors.textOnDark} />
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trail: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
