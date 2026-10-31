import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics, useReducedMotion } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';

/** What a toast reports: something done, something that failed, or plain news. */
export type ToastTone = 'success' | 'error' | 'info';

export type ToastProps = {
  visible: boolean;
  message: string;
  /**
   * Picks the leading glyph and its colour. `success` is the artboard's green check (Figma
   * 1:2926); `error` is a red "!" and buzzes, so a failure never wears the success check.
   */
  tone?: ToastTone;
  /** Overrides the tone's glyph. */
  icon?: LineIconName;
  /** Auto-dismiss delay. The caller owns `visible`; this just asks it to flip. */
  durationMs?: number;
  onHide: () => void;
};

// Drawn at 390 by PROFILE 25 (577:3798), in artboard units. A single line stays the older
// board's 56 tall (1:2924); a longer message wraps to a second line instead of being cut off.
const MIN_HEIGHT = 56;
const PAD_X = 15 / 0.75;
const PAD_Y = 11 / 0.75;
const GAP = 9 / 0.75;
const RADIUS = 13 / 0.75;

const TONE_GLYPH: Record<ToastTone, { icon: LineIconName; color: ColorToken }> = {
  success: { icon: 'Check', color: 'successRing' },
  error: { icon: 'AlertCircle', color: 'dangerDot' },
  info: { icon: 'InfoCircle', color: 'textOnDark' },
};

/**
 * Transient confirmation bar (Figma 1:2924 — "Application sent to Stripe", redrawn as PROFILE 25
 * 577:3798): ink surface, floating below the status bar, up to two lines. Announced politely to
 * screen readers; it dismisses itself, so it never traps focus.
 */
export function Toast({
  visible,
  message,
  tone = 'success',
  icon,
  durationMs = 3000,
  onHide,
}: ToastProps) {
  const { colors, motion, shadows, spacing, zIndex, s } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // The latest `onHide`, read when the timer fires. Hosts pass it inline, so as a dependency it
  // restarted the timer on every parent render — and a host re-rendering every progress tick
  // (the run screens) kept its toast up for good.
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  });

  // A failure is felt as well as read: one error buzz per failure shown.
  useEffect(() => {
    if (visible && tone === 'error') haptics.error();
  }, [message, tone, visible]);

  // A new message restarts the clock, so it gets its full time on screen.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => onHideRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, message, visible]);

  return (
    // Always mounted, so hiding removes only the bar and its exit animation plays from here.
    <View
      pointerEvents="none"
      style={[
        styles.overlay,
        { top: insets.top + spacing[3], paddingHorizontal: spacing.gutter, zIndex: zIndex.toast },
      ]}
    >
      {visible ? (
        <Animated.View
          // Keyed on the message: a second toast while one shows replaces it — the old bar leaves,
          // the new one arrives — instead of the text changing under a bar that never moved.
          key={message}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          entering={reduced ? undefined : FadeInDown.duration(motion.durations.base)}
          exiting={reduced ? undefined : FadeOutUp.duration(motion.durations.fast)}
          style={[
            styles.bar,
            shadows.toast,
            {
              minHeight: s(MIN_HEIGHT),
              gap: s(GAP),
              borderRadius: s(RADIUS),
              backgroundColor: colors.surfaceInverse,
              paddingHorizontal: s(PAD_X),
              paddingVertical: s(PAD_Y),
            },
          ]}
        >
          <Icon
            name={icon ?? TONE_GLYPH[tone].icon}
            size="sm"
            color={colors[TONE_GLYPH[tone].color]}
          />
          <Text variant="captionSemiBold" color="textOnDark" numberOfLines={2} style={styles.label}>
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, alignItems: 'stretch' },
  bar: { flexDirection: 'row', alignItems: 'center' },
  label: { flexShrink: 1 },
});
