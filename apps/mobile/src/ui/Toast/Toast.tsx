import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type ToastProps = {
  visible: boolean;
  message: string;
  /** Leading FA5 glyph; the artboard's confirmation check is green (Figma 1:2926). */
  icon?: string;
  /** Auto-dismiss delay. The caller owns `visible`; this just asks it to flip. */
  durationMs?: number;
  onHide: () => void;
};

const HEIGHT = 56;
const ICON = 15;

/**
 * Transient confirmation bar (Figma 1:2924 — "Application sent to Stripe"): ink surface,
 * r16, floating below the status bar. Announced politely to screen readers; it dismisses
 * itself, so it never traps focus.
 */
export function Toast({ visible, message, icon = 'check', durationMs = 3000, onHide }: ToastProps) {
  const { colors, motion, radii, shadows, spacing, zIndex } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onHide, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onHide, visible]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.overlay,
        { top: insets.top + spacing[3], paddingHorizontal: spacing.gutter, zIndex: zIndex.toast },
      ]}
    >
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        entering={reduced ? undefined : FadeInDown.duration(motion.durations.base)}
        exiting={reduced ? undefined : FadeOutUp.duration(motion.durations.fast)}
        style={[
          styles.bar,
          shadows.toast,
          {
            height: HEIGHT,
            gap: spacing[2] + 2,
            borderRadius: radii.xl,
            backgroundColor: colors.surfaceInverse,
            paddingHorizontal: spacing[5],
          },
        ]}
      >
        <FontAwesome5 name={icon} size={ICON} color={colors.successRing} solid />
        <Text variant="bodySemiBold" color="textOnDark" numberOfLines={1} style={styles.label}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, alignItems: 'stretch' },
  bar: { flexDirection: 'row', alignItems: 'center' },
  label: { flexShrink: 1 },
});
